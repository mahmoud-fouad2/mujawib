import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { auditLog, call } from '@/server/db/schema'
import { buildAcceptPayload, resolveAgentForNumber } from '@/server/voice/session'

/**
 * Inbound call webhook — Product Bible §27, call path steps 4 and 5.
 *
 * Flow:
 *   caller → carrier → SIP trunk → sip:{project}@sip.api.openai.com
 *   → OpenAI posts `realtime.call.incoming` here
 *   → we identify the dialled number, resolve its published agent
 *   → we accept the call with that agent's compiled session
 *
 * A number with no published agent is refused rather than answered by a draft,
 * so the carrier can fail over to the human line.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPENAI_API = 'https://api.openai.com/v1'

/**
 * Verifies the Standard Webhooks signature OpenAI sends.
 *
 * Without this, anyone who learns the URL can make the platform answer calls
 * on a client's behalf. Skipped only when no secret is configured, which is
 * logged loudly so it cannot pass unnoticed into production.
 */
function verifySignature(req: NextRequest, raw: string): boolean {
  const secret = process.env.OPENAI_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[voice] OPENAI_WEBHOOK_SECRET is not set — webhook is UNVERIFIED')
    return true
  }

  const id = req.headers.get('webhook-id')
  const timestamp = req.headers.get('webhook-timestamp')
  const signatureHeader = req.headers.get('webhook-signature')
  if (!id || !timestamp || !signatureHeader) return false

  // Reject anything older than five minutes to stop replays.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64')

  // The header may carry several space-separated `v1,<sig>` values.
  return signatureHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig) return false
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

type IncomingEvent = {
  type: string
  data?: {
    call_id?: string
    sip_headers?: { name: string; value: string }[]
  }
}

/** OpenAI forwards the SIP headers; To/From carry the numbers we need. */
function sipHeader(event: IncomingEvent, name: string): string | null {
  const header = event.data?.sip_headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
  if (!header) return null
  // `"Name" <sip:+966...@host>` → +966...
  const match = header.value.match(/sip:([^@;>]+)/)
  return match?.[1] ?? header.value
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  if (!verifySignature(req, raw)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: IncomingEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if (event.type !== 'realtime.call.incoming') {
    // Other event types are acknowledged so OpenAI stops retrying them.
    return NextResponse.json({ received: true })
  }

  const callId = event.data?.call_id
  if (!callId) return NextResponse.json({ error: 'missing call_id' }, { status: 400 })

  const dialled = sipHeader(event, 'To')
  const caller = sipHeader(event, 'From')
  if (!dialled) return NextResponse.json({ error: 'missing To header' }, { status: 400 })

  const resolved = await resolveAgentForNumber(dialled)

  if (!resolved) {
    // Refusing lets the carrier fail over. Answering with a draft would put an
    // untested agent in front of a real customer.
    console.warn(`[voice] no published agent for ${dialled} — refusing call ${callId}`)
    await fetch(`${OPENAI_API}/realtime/calls/${callId}/refer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_uri: `tel:${dialled}` }),
    }).catch(() => undefined)

    return NextResponse.json({ accepted: false, reason: 'no published agent' }, { status: 200 })
  }

  const accept = await fetch(`${OPENAI_API}/realtime/calls/${callId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildAcceptPayload(resolved)),
  })

  if (!accept.ok) {
    const detail = await accept.text()
    console.error(`[voice] accept failed for ${callId}: ${accept.status} ${detail}`)
    return NextResponse.json({ accepted: false }, { status: 502 })
  }

  // Record the call immediately so it appears in the console while it runs.
  const now = new Date()
  const id = `call_${randomUUID().replaceAll('-', '').slice(0, 16)}`

  await db.insert(call).values({
    id,
    workspaceId: resolved.workspaceId,
    agentVersionId: resolved.versionId,
    phoneNumberId: resolved.phoneNumberId,
    externalCallId: callId,
    callerNumber: caller,
    status: 'live',
    transcript: [],
    metadata: { dialled, agentName: resolved.agentName },
    startedAt: now,
    createdAt: now,
  })

  await db.insert(auditLog).values({
    id: `audit_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    workspaceId: resolved.workspaceId,
    actorId: 'voice',
    action: 'call.accepted',
    resourceType: 'call',
    resourceId: id,
    metadata: {
      note: `مكالمة واردة على ${dialled} — ${resolved.agentName} v${resolved.versionNumber}`,
    },
    createdAt: now,
  })

  return NextResponse.json({ accepted: true, callId: id })
}

/** Lets you confirm the endpoint is reachable before pointing OpenAI at it. */
export async function GET() {
  return NextResponse.json({
    endpoint: 'voice/incoming',
    ready: Boolean(process.env.OPENAI_API_KEY),
    signatureVerification: Boolean(process.env.OPENAI_WEBHOOK_SECRET),
  })
}
