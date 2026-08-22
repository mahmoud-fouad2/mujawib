import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { auditLog, call, webhookReceipt } from '@/server/db/schema'
import {
  protectedLookup,
  protectJson,
  protectString,
  revealString,
} from '@/server/security/protected-data'
import {
  maskIdentifier,
  maskNumber,
  sanitizeLogText,
  sanitizeSipHeaders,
  voiceError,
  voiceLog,
} from '@/server/voice/log'
import { markPhoneAnswered, markPhoneReached } from '@/server/voice/phone'
import { buildAcceptPayload, resolveAgentFromCandidates } from '@/server/voice/session'
import { startRealtimeSideband } from '@/server/voice/sideband'
import { callerFrom, didCandidates, providerObserved, type SipHeader } from '@/server/voice/sip'

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
  voiceLog('CALL_REJECTED', { callId: maskIdentifier(callId), reason })
  await fetch(`${OPENAI_API}/realtime/calls/${callId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status_code: 486 }),
  }).catch((error) => voiceError('ERROR', `reject failed: ${sanitizeLogText(String(error))}`))
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
  voiceLog('CALL_ID', maskIdentifier(callId))

  const webhookId = req.headers.get('webhook-id') as string
  const receiptNow = new Date()
  await db
    .insert(webhookReceipt)
    .values({
      id: webhookId,
      eventType: event.type,
      externalCallId: callId,
      status: 'processing',
      receivedAt: receiptNow,
      updatedAt: receiptNow,
    })
    .onConflictDoUpdate({
      target: webhookReceipt.id,
      set: {
        attemptCount: sql`${webhookReceipt.attemptCount} + 1`,
        updatedAt: receiptNow,
      },
    })

  // Logged before anything can fail on them: the first real call exists to
  // show which header this provider uses for the originally dialled DID.
  const headers = event.data?.sip_headers
  const safeHeaders = sanitizeSipHeaders(headers)
  voiceLog('SIP_HEADERS', safeHeaders)

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
      callId: maskIdentifier(callId),
      triedCandidates: safeCandidates.map((candidate) => `${candidate.header}=${candidate.e164}`),
      hint: 'no configured phone_number matched any candidate',
    })
    await rejectCall(callId, 'no configured route')
    await db
      .update(webhookReceipt)
      .set({ status: 'rejected', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(webhookReceipt.id, webhookId))
    return NextResponse.json(
      { accepted: false, reason: 'no configured route', candidates: safeCandidates },
      { status: 200 },
    )
  }

  voiceLog('PHONE_ROUTE_RESOLVED', {
    matchedHeader: resolved.matchedHeader,
    matchedE164: maskNumber(resolved.matchedE164),
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

  const now = new Date()
  const proposedId = `call_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  const [reserved] = await db
    .insert(call)
    .values({
      id: proposedId,
      workspaceId: resolved.workspaceId,
      agentVersionId: resolved.versionId,
      phoneNumberId: resolved.phoneNumberId,
      externalCallId: callId,
      callerNumber: maskNumber(caller),
      callerNumberEncrypted: caller ? protectString(caller) : null,
      callerNumberHash: caller ? protectedLookup(caller) : null,
      status: 'accepting',
      origin: 'live',
      transcript: [],
      transcriptEncrypted: protectJson([]),
      sipMetadataEncrypted: protectJson({
        matchedHeader: resolved.matchedHeader,
        headers: safeHeaders,
      }),
      metadata: {
        phoneNumber: resolved.matchedE164,
        matchedE164: resolved.matchedE164,
        clientId: resolved.workspaceId,
        clientName: resolved.workspaceName,
        agentId: resolved.agentId,
        agentName: resolved.agentName,
        agentVersionId: resolved.versionId,
        agentVersionNumber: resolved.versionNumber,
        openAiCallId: callId,
        routingMethod: 'explicit_phone_number',
        providerObserved: sanitizeLogText(providerObserved(headers) ?? '') || null,
        callerMasked: maskNumber(caller),
        sip: { matchedHeader: resolved.matchedHeader, protected: true },
      },
      startedAt: now,
      createdAt: now,
    })
    .onConflictDoNothing({ target: call.externalCallId })
    .returning()

  const [callRecord] = reserved
    ? [reserved]
    : await db.select().from(call).where(eq(call.externalCallId, callId)).limit(1)

  if (!callRecord) {
    voiceError('ERROR', 'call reservation failed without a recoverable record')
    return NextResponse.json({ accepted: false }, { status: 503 })
  }

  if (callRecord.status !== 'accepting') {
    if (callRecord.status === 'live' || callRecord.status === 'waiting_tool') {
      await startRealtimeSideband({
        callRecordId: callRecord.id,
        externalCallId: callId,
        workspaceId: callRecord.workspaceId,
        callerNumber: revealString(callRecord.callerNumberEncrypted) ?? callRecord.callerNumber,
        transferTo: resolved.transferTo,
        startedAt: callRecord.startedAt,
      })
    }
    voiceLog('CALL_RECORDED', {
      id: callRecord.id,
      caller: maskNumber(callRecord.callerNumber),
      replay: true,
    })
    return NextResponse.json({
      accepted: callRecord.status !== 'failed' && callRecord.status !== 'abandoned',
      callId: callRecord.id,
      replay: true,
    })
  }

  voiceLog('ACCEPT_REQUEST_STARTED', {
    callId: maskIdentifier(callId),
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
    voiceError('ERROR', `accept threw: ${sanitizeLogText(String(error))}`)
    return null
  })

  voiceLog('ACCEPT_RESPONSE_STATUS', accept ? accept.status : 'no response')

  const alreadyAccepted = accept?.status === 409
  if (!accept?.ok && !alreadyAccepted) {
    const detail = accept ? await accept.text() : 'request failed'
    voiceError('ERROR', `accept rejected: ${sanitizeLogText(detail)}`)
    await markPhoneReached(resolved.phoneNumberId)
    const transient = !accept || accept.status >= 500
    await db.transaction(async (tx) => {
      if (!transient) {
        await tx
          .update(call)
          .set({ status: 'failed', endedAt: new Date() })
          .where(eq(call.id, callRecord.id))
      }
      await tx
        .update(webhookReceipt)
        .set({
          status: transient ? 'retryable' : 'rejected',
          lastError: `accept:${accept?.status ?? 'network'}`,
          ...(transient ? {} : { completedAt: new Date() }),
          updatedAt: new Date(),
        })
        .where(eq(webhookReceipt.id, webhookId))
    })
    return NextResponse.json({ accepted: false }, { status: transient ? 503 : 200 })
  }

  voiceLog('CALL_ACCEPTED', { callId: maskIdentifier(callId), agent: resolved.agentName })

  try {
    await db.transaction(async (tx) => {
      await tx.update(call).set({ status: 'live' }).where(eq(call.id, callRecord.id))
      await tx.insert(auditLog).values({
        id: `audit_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
        workspaceId: resolved.workspaceId,
        actorId: 'voice',
        action: 'call.accepted',
        resourceType: 'call',
        resourceId: callRecord.id,
        metadata: {
          note: `مكالمة واردة على ${resolved.matchedE164} — ${resolved.agentName} v${resolved.versionNumber}`,
        },
        createdAt: now,
      })
      await tx
        .update(webhookReceipt)
        .set({ status: 'completed', completedAt: now, updatedAt: now, lastError: null })
        .where(eq(webhookReceipt.id, webhookId))
    })
  } catch (error) {
    voiceError('ERROR', `could not finalize call: ${sanitizeLogText(String(error))}`)
    return NextResponse.json({ accepted: true, recorded: true, finalized: false }, { status: 503 })
  }

  voiceLog('CALL_RECORDED', { id: callRecord.id, caller: maskNumber(caller) })

  // OpenAI keeps SIP audio on its media path. This server-side socket joins
  // the accepted session only for private events, transcript and tool calls.
  await startRealtimeSideband({
    callRecordId: callRecord.id,
    externalCallId: callId,
    workspaceId: resolved.workspaceId,
    callerNumber: caller,
    transferTo: resolved.transferTo,
    startedAt: now,
  })

  const evidence = {
    matchedHeader: resolved.matchedHeader,
    matchedE164: resolved.matchedE164,
    externalCallId: callId,
    callId: callRecord.id,
    agentVersionId: resolved.versionId,
    observedAt: now.toISOString(),
  }

  const [phoneResult] = await Promise.allSettled([
    markPhoneAnswered(resolved.phoneNumberId, evidence),
  ])
  if (phoneResult.status === 'rejected') {
    voiceError('ERROR', 'call was recorded but phone evidence was not updated')
  }

  return NextResponse.json({ accepted: true, callId: callRecord.id })
}

export async function GET() {
  return NextResponse.json({ status: 'ready' })
}
