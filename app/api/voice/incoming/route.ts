import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { auditLog, call } from '@/server/db/schema'
import { maskNumber, sanitizeSipHeaders, voiceError, voiceLog } from '@/server/voice/log'
import { markPhoneAnswered, markPhoneReached } from '@/server/voice/phone'
import { buildAcceptPayload, resolveAgentFromCandidates } from '@/server/voice/session'
import { callerFrom, didCandidates, type SipHeader } from '@/server/voice/sip'

/**
 * Inbound call webhook — Product Bible §27, call path steps 4 and 5.
 *
 *   caller → PSTN → ingress provider → sip:{project}@sip.api.openai.com
 *   → OpenAI posts `realtime.call.incoming` here
 *   → we find which configured DID this call arrived on
 *   → we accept it with that route's published agent
 *
 * Provider-neutral by design: nothing below knows or cares which carrier sent
 * the call. The dialled number is discovered from the SIP headers and matched
 * against explicitly configured routes.
 *
 * An unrecognised DID is rejected, never answered by a default client.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPENAI_API = 'https://api.openai.com/v1'

/**
 * Verifies the Standard Webhooks signature OpenAI sends.
 *
 * Without this, anyone who learns the URL can make the platform answer calls
 * on a client's behalf.
 */
function verifySignature(req: NextRequest, raw: string): boolean {
  const secret = process.env.OPENAI_WEBHOOK_SECRET
  if (!secret) {
    voiceError('SIGNATURE_REJECTED', 'OPENAI_WEBHOOK_SECRET is not set — refusing to verify')
    return false
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
  data?: { call_id?: string; sip_headers?: SipHeader[] }
}

/** Ends a call we will not answer. Never refers it back to the dialled DID. */
async function rejectCall(callId: string, reason: string) {
  voiceLog('CALL_REJECTED', { callId, reason })
  await fetch(`${OPENAI_API}/realtime/calls/${callId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status_code: 486 }),
  }).catch((error) => voiceError('ERROR', `reject failed: ${String(error)}`))
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  voiceLog('WEBHOOK_RECEIVED', { bytes: raw.length })

  if (!verifySignature(req, raw)) {
    voiceError('SIGNATURE_REJECTED', 'signature did not validate')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  voiceLog('SIGNATURE_VERIFIED')

  let event: IncomingEvent
  try {
    event = JSON.parse(raw)
  } catch {
    voiceError('ERROR', 'payload was not JSON')
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if (event.type !== 'realtime.call.incoming') {
    voiceLog('EVENT_IGNORED', event.type)
    return NextResponse.json({ received: true })
  }

  const callId = event.data?.call_id
  if (!callId) {
    voiceError('ERROR', 'event carried no call_id')
    return NextResponse.json({ error: 'missing call_id' }, { status: 400 })
  }
  voiceLog('CALL_ID', callId)

  // Logged before anything can fail on them: the first real call exists to
  // show which header this provider uses for the originally dialled DID.
  const headers = event.data?.sip_headers
  voiceLog('SIP_HEADERS', sanitizeSipHeaders(headers))

  const candidates = didCandidates(headers)
  const safeCandidates = candidates.map((candidate) => ({
    header: candidate.header,
    e164: maskNumber(candidate.e164),
  }))
  voiceLog('DID_CANDIDATES', safeCandidates)

  const resolved = await resolveAgentFromCandidates(candidates)

  if (!resolved) {
    // No default client, no first-row fallback. An unknown DID stays unknown.
    voiceLog('PHONE_ROUTE_NOT_RESOLVED', {
      callId,
      triedCandidates: safeCandidates.map((candidate) => `${candidate.header}=${candidate.e164}`),
      hint: 'no configured phone_number matched any candidate',
    })
    await rejectCall(callId, 'no configured route')
    return NextResponse.json(
      { accepted: false, reason: 'no configured route', candidates: safeCandidates },
      { status: 200 },
    )
  }

  voiceLog('PHONE_ROUTE_RESOLVED', {
    matchedHeader: resolved.matchedHeader,
    matchedE164: resolved.matchedE164,
  })
  voiceLog('CLIENT_RESOLVED', { workspaceId: resolved.workspaceId, name: resolved.workspaceName })
  voiceLog('AGENT_VERSION_RESOLVED', {
    agent: resolved.agentName,
    versionId: resolved.versionId,
    version: resolved.versionNumber,
    voice: resolved.voice,
    toolCount: resolved.tools.length,
  })

  const caller = callerFrom(headers)
  const payload = buildAcceptPayload(resolved)

  voiceLog('ACCEPT_REQUEST_STARTED', {
    callId,
    model: payload.model,
    instructionChars: payload.instructions.length,
  })

  const accept = await fetch(`${OPENAI_API}/realtime/calls/${callId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    voiceError('ERROR', `accept threw: ${String(error)}`)
    return null
  })

  voiceLog('ACCEPT_RESPONSE_STATUS', accept ? accept.status : 'no response')

  if (!accept?.ok) {
    const detail = accept ? await accept.text() : 'request failed'
    voiceError('ERROR', `accept rejected: ${detail.slice(0, 500)}`)
    // The call did reach us on this number and did resolve to an agent, so the
    // carrier side is proven even though we failed to answer. Recording that
    // separates "the number never rang here" from "we could not pick up".
    await markPhoneReached(resolved.phoneNumberId)
    return NextResponse.json({ accepted: false }, { status: 502 })
  }

  voiceLog('CALL_ACCEPTED', { callId, agent: resolved.agentName })

  // Recorded immediately so the call appears in the console while it runs.
  const now = new Date()
  const id = `call_${randomUUID().replaceAll('-', '').slice(0, 16)}`

  try {
    await db.insert(call).values({
      id,
      workspaceId: resolved.workspaceId,
      agentVersionId: resolved.versionId,
      phoneNumberId: resolved.phoneNumberId,
      externalCallId: callId,
      callerNumber: caller,
      status: 'live',
      // A real caller on a real number — not part of the generated dataset the
      // console is otherwise full of.
      origin: 'live',
      transcript: [],
      metadata: {
        phoneNumber: resolved.matchedE164,
        clientId: resolved.workspaceId,
        clientName: resolved.workspaceName,
        agentId: resolved.agentId,
        agentName: resolved.agentName,
        agentVersionId: resolved.versionId,
        agentVersionNumber: resolved.versionNumber,
        openAiCallId: callId,
        routingMethod: 'explicit_phone_number',
        sip: {
          matchedHeader: resolved.matchedHeader,
          headers: sanitizeSipHeaders(headers),
        },
      },
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
        note: `مكالمة واردة على ${resolved.matchedE164} — ${resolved.agentName} v${resolved.versionNumber}`,
      },
      createdAt: now,
    })

    voiceLog('CALL_RECORDED', { id, caller: maskNumber(caller) })

    // The number is now proven end to end, by this call rather than by
    // configuration. Nothing else in the system is allowed to set this.
    await markPhoneAnswered(resolved.phoneNumberId, {
      matchedHeader: resolved.matchedHeader,
      matchedE164: resolved.matchedE164,
      externalCallId: callId,
      callId: id,
      agentVersionId: resolved.versionId,
      observedAt: now.toISOString(),
    })
  } catch (error) {
    // The call is already answered; failing to record it must not end it.
    voiceError('ERROR', `could not record call: ${String(error)}`)
  }

  return NextResponse.json({ accepted: true, callId: id })
}

/** Confirms the endpoint is reachable and configured, before pointing OpenAI at it. */
export async function GET() {
  return NextResponse.json({
    endpoint: 'voice/incoming',
    revision: 'first-twilio-call-v1',
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    webhookSecretConfigured: Boolean(process.env.OPENAI_WEBHOOK_SECRET),
  })
}
