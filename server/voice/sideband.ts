import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import WebSocket, { type RawData } from 'ws'
import { maxCallDurationMs } from '@/lib/call-limits'
import { enqueueCallIntelligence } from '@/server/calls/intelligence'
import { compactCallTranscript } from '@/server/calls/transcript'
// Every query in this file sits on a live call's critical path, so it runs on
// the dedicated realtime pool rather than the shared application one — a call
// must never queue behind a server-rendered console page. See server/db/index.ts.
import { dbRealtime as db } from '@/server/db'
import { backgroundJob, call, callEvent, toolExecution } from '@/server/db/schema'
import { notifyOperators, notifyWorkspaceMembers, tryNotify } from '@/server/notifications/service'
import { registerDrainHook } from '@/server/runtime/lifecycle'
import { protectJson, protectString, revealString } from '@/server/security/protected-data'
import { acquireCallSlot, type CallSlot } from '@/server/voice/admission'
import { executeTool } from '@/server/voice/handlers'
import { maskIdentifier, sanitizeLogText, voiceError, voiceLog } from '@/server/voice/log'
import {
  actionsFromRealtimeEvent,
  initialGreetingEvent,
  type RealtimeAction,
  type RealtimeToolAction,
  type RealtimeTranscriptAction,
  shouldSendInitialGreeting,
} from '@/server/voice/realtime-events'
import { type RealtimeRecordingCapture, startRealtimeRecording } from '@/server/voice/recording'
import {
  type RealtimeSessionError,
  resolveSidebandCloseDiagnostic,
} from '@/server/voice/sideband-diagnostics'
import {
  type CallTimeline,
  createTimeline,
  markTimeline,
  timelineSnapshot,
  withCallContext,
} from '@/server/voice/telemetry'
import type { ToolResult } from '@/server/voice/tools'

const REALTIME_WS = 'wss://api.openai.com/v1/realtime'
const OPENAI_API = 'https://api.openai.com/v1'
const CONNECT_TIMEOUT_MS = 10_000
const SIDEBAND_LEASE_MS = 120_000
const HANGUP_FALLBACK_MS = 5_000
// Read once per process rather than per call: this is an operational dial,
// not something that changes mid-deploy, and re-parsing it on every call is
// pointless work on the hottest path in the codebase.
const MAX_CALL_DURATION_MS = maxCallDurationMs(process.env.MAX_CALL_DURATION_MINUTES)
const NORMAL_CLOSE_CODES = new Set([1000, 1005])

type SidebandContext = {
  callRecordId: string
  externalCallId: string
  workspaceId: string
  callerNumber: string | null
  transferTo: string | null
  startedAt: Date
  /**
   * True when attaching to a call that is already in progress — the process
   * that answered it went away and `recoverStaleSidebands` reconnected. Such a
   * socket must not make the agent greet the caller again.
   */
  resumed?: boolean
  /** Released when the call ends, freeing a process-wide concurrency slot. */
  slot?: CallSlot | null
  /** Shared with the inbound webhook so setup and call time are one timeline. */
  timeline?: CallTimeline | null
}

type SessionState = {
  /**
   * When the caller stopped speaking, i.e. when the clock on this turn starts.
   * Consumed by the first audio of the response that answers it, then cleared,
   * so a follow-up response cannot be credited to the same turn.
   */
  turnStartedAt: number | null
  /**
   * Measured turn latency per response id, recorded the moment audio starts
   * playing. The transcript arrives much later and reads its value from here
   * rather than re-measuring — that re-measurement was the bug.
   */
  turnLatencyByResponse: Map<string, number>
  lastRealtimeError: RealtimeSessionError | null
  seenToolCalls: Set<string>
  inputTokens: number
  outputTokens: number
  activeResponse: boolean
  pendingResponseInstructions: string | null
  pendingHangup: boolean
  hangupResponseStarted: boolean
  hangupRequested: boolean
  hangupSucceeded: boolean
  hasConversation: boolean
  /**
   * Set when this process is shutting down and has deliberately released the
   * call to its replacement. The close that follows is a handover, not an end:
   * the call row stays `live` so the next process can pick it up.
   */
  handedOff: boolean
}

type ActiveSideband = {
  ws: WebSocket
  ctx: SidebandContext
  state: SessionState
  leaseOwner: string
}

/**
 * Every control socket this process currently owns, keyed by the provider's
 * call id. Exists so shutdown can find them; nothing else reads it.
 */
const activeSockets = new Map<string, ActiveSideband>()

/** Close code for a deliberate handover, per RFC 6455 ("going away"). */
const GOING_AWAY = 1001

export function activeSidebandCount(): number {
  return activeSockets.size
}

/**
 * Hands every still-live call to the process that is replacing this one.
 *
 * Releasing the lease is the whole point. On an abrupt kill the row keeps
 * `status: 'running'` with a stale `lockedAt`, and the replacement cannot
 * touch it until the 120-second staleness window expires — two minutes during
 * which the caller is talking to an agent that can no longer run a tool or
 * hang up. Setting it back to `pending` makes it reclaimable on the very next
 * maintenance tick instead.
 *
 * The call row itself is deliberately left alone: the call has not ended, and
 * `state.handedOff` stops the close handler from writing an end time.
 */
async function handOffActiveSidebands() {
  const sockets = [...activeSockets.values()]
  if (sockets.length === 0) return

  await Promise.allSettled(
    sockets.map(async (entry) => {
      entry.state.handedOff = true
      await db
        .update(backgroundJob)
        .set({ status: 'pending', lockedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(backgroundJob.id, sidebandJobId(entry.ctx.externalCallId)),
            sql`${backgroundJob.payload}->>'leaseOwner' = ${entry.leaseOwner}`,
          ),
        )
        .catch(() => undefined)
      await recordEvent(entry.ctx, 'sideband_handed_off', `drain:${Date.now()}`, {
        reason: 'process_shutdown',
      }).catch(() => undefined)
      try {
        entry.ws.close(GOING_AWAY, 'draining')
      } catch {
        entry.ws.terminate()
      }
    }),
  )
}

let drainHookRegistered = false

/**
 * Called once at boot from `instrumentation.ts`. Registration is explicit
 * rather than a module-load side effect so importing this file from a script
 * or a test never installs process-wide behaviour.
 */
export function registerSidebandDrainHook() {
  if (drainHookRegistered) return
  drainHookRegistered = true
  registerDrainHook({
    name: 'realtime-sideband',
    active: activeSidebandCount,
    handOff: handOffActiveSidebands,
  })
}

function stableId(prefix: string, ...parts: string[]) {
  const digest = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 24)
  return `${prefix}_${digest}`
}

function sidebandJobId(externalCallId: string) {
  return stableId('job', 'sideband', externalCallId)
}

async function claimSideband(ctx: SidebandContext, leaseOwner: string) {
  const now = new Date()
  const id = sidebandJobId(ctx.externalCallId)
  const [inserted] = await db
    .insert(backgroundJob)
    .values({
      id,
      type: 'realtime_sideband',
      dedupeKey: `sideband:${ctx.externalCallId}`,
      payload: {
        callRecordId: ctx.callRecordId,
        externalCallId: ctx.externalCallId,
        workspaceId: ctx.workspaceId,
        callerNumberProtected: ctx.callerNumber ? protectString(ctx.callerNumber) : null,
        transferToProtected: ctx.transferTo ? protectString(ctx.transferTo) : null,
        startedAt: ctx.startedAt.toISOString(),
        leaseOwner,
      },
      status: 'running',
      attempts: 1,
      availableAt: now,
      lockedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: backgroundJob.dedupeKey })
    .returning({ id: backgroundJob.id })
  if (inserted) return true

  const staleBefore = new Date(now.getTime() - SIDEBAND_LEASE_MS)
  const [reclaimed] = await db
    .update(backgroundJob)
    .set({
      status: 'running',
      lockedAt: now,
      attempts: sql`${backgroundJob.attempts} + 1`,
      payload: sql`${backgroundJob.payload} || ${JSON.stringify({ leaseOwner })}::jsonb`,
      completedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(backgroundJob.id, id),
        or(
          eq(backgroundJob.status, 'pending'),
          and(eq(backgroundJob.status, 'running'), lt(backgroundJob.lockedAt, staleBefore)),
        ),
      ),
    )
    .returning({ id: backgroundJob.id })
  return Boolean(reclaimed)
}

async function finishSidebandJob(
  ctx: SidebandContext,
  leaseOwner: string,
  normal: boolean,
  reason: string | null,
) {
  await db
    .update(backgroundJob)
    .set({
      status: normal ? 'completed' : 'failed',
      completedAt: new Date(),
      lastError: normal ? null : reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(backgroundJob.id, sidebandJobId(ctx.externalCallId)),
        sql`${backgroundJob.payload}->>'leaseOwner' = ${leaseOwner}`,
      ),
    )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseArguments(value: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

async function recordEvent(
  ctx: SidebandContext,
  type: string,
  sourceId: string,
  payload: Record<string, unknown> = {},
  latencyMs?: number,
  payloadEncrypted?: string,
) {
  await db
    .insert(callEvent)
    .values({
      id: stableId('cev', ctx.callRecordId, type, sourceId),
      callId: ctx.callRecordId,
      type,
      payload,
      ...(payloadEncrypted ? { payloadEncrypted } : {}),
      ...(latencyMs === undefined ? {} : { latencyMs }),
      occurredAt: new Date(),
    })
    .onConflictDoNothing()
}

/**
 * Merges keys into `call.metadata` in one round trip.
 *
 * This used to read the row, merge in memory, and write it back — two
 * sequential queries on a live call, and a lost update whenever anything else
 * touched the same row in between. `||` on jsonb is a shallow merge performed
 * by Postgres, which is both atomic and half the latency.
 */
async function mergeCallMetadata(ctx: SidebandContext, patch: Record<string, unknown>) {
  await db
    .update(call)
    .set({
      metadata: sql`coalesce(${call.metadata}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(call.id, ctx.callRecordId))
}

/** Persists the call's timing marks under `call.metadata.timeline`. */
async function persistTimeline(ctx: SidebandContext) {
  if (!ctx.timeline) return
  await mergeCallMetadata(ctx, { timeline: timelineSnapshot(ctx.timeline) })
}

async function appendTranscript(
  ctx: SidebandContext,
  action: RealtimeTranscriptAction,
  state: SessionState,
) {
  const cleanText = action.text.replace(/\s+/g, ' ').trim().slice(0, 4_000)
  if (!cleanText) return
  state.hasConversation = true

  const turnId = stableId('turn', ctx.callRecordId, action.role, action.sourceId)
  const at = Math.max(0, (Date.now() - ctx.startedAt.getTime()) / 1000)

  // Read, never re-measure. This value was captured at `output_audio_started`
  // — the instant the caller began hearing the reply. Measuring here instead,
  // as this did before, timed the arrival of the finished transcript, which
  // lands only after the agent has stopped speaking: an eight-second answer
  // was being recorded as eight seconds of latency. When the response id is
  // absent there is simply no number, because a wrong one is worse than none.
  const latencyMs =
    action.role === 'agent' && action.responseId
      ? state.turnLatencyByResponse.get(action.responseId)
      : undefined
  if (action.responseId) state.turnLatencyByResponse.delete(action.responseId)

  await recordEvent(
    ctx,
    action.role === 'agent' ? 'agent_turn' : 'caller_turn',
    turnId,
    {
      role: action.role,
      characters: cleanText.length,
      sourceEvent: action.eventType,
      ...(latencyMs === undefined ? {} : { firstAudioMs: latencyMs }),
    },
    latencyMs,
    protectJson({ role: action.role, text: cleanText, at, sourceId: turnId }),
  )
}

async function referCall(externalCallId: string, destination: string): Promise<boolean> {
  const target = destination.trim().replace(/[^\d+]/g, '')
  if (!target) return false

  const response = await fetch(`${OPENAI_API}/realtime/calls/${externalCallId}/refer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target_uri: `tel:${target}` }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)

  return Boolean(response?.ok)
}

async function hangupCall(externalCallId: string): Promise<boolean> {
  const response = await fetch(`${OPENAI_API}/realtime/calls/${externalCallId}/hangup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  return Boolean(response?.ok)
}

async function recordInvalidArguments(
  ctx: SidebandContext,
  action: RealtimeToolAction,
): Promise<ToolResult> {
  const result: ToolResult = {
    ok: false,
    error: 'بيانات الإجراء غير صالحة. لم يتم تنفيذ الطلب.',
    fallback: 'retry',
  }

  await db
    .insert(toolExecution)
    .values({
      id: stableId('tex', ctx.callRecordId, action.toolCallId),
      callId: ctx.callRecordId,
      toolName: action.name,
      request: {},
      requestEncrypted: protectJson({}),
      result: { protected: true },
      resultEncrypted: protectJson(result),
      status: 'failed',
      latencyMs: 0,
      executedAt: new Date(),
    })
    .onConflictDoNothing()

  return result
}

function requestResponse(ws: WebSocket, state: SessionState, instructions?: string) {
  if (ws.readyState !== WebSocket.OPEN) return
  if (state.activeResponse) {
    state.pendingResponseInstructions = instructions ?? state.pendingResponseInstructions ?? ''
    return
  }

  state.activeResponse = true
  ws.send(
    JSON.stringify({
      type: 'response.create',
      ...(instructions ? { response: { instructions } } : {}),
    }),
  )
}

function sendToolOutput(ws: WebSocket, action: RealtimeToolAction, result: ToolResult) {
  if (ws.readyState !== WebSocket.OPEN) return

  ws.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: action.toolCallId,
        output: JSON.stringify(result),
      },
    }),
  )
}

/**
 * Runs a promise the caller does not wait for, without losing its failure.
 *
 * Used for writes that exist to drive the operator's screen rather than the
 * conversation. Awaiting those put database round trips between the model
 * asking a question and hearing its answer, which the caller experiences as
 * the agent going silent.
 */
function detach(operation: Promise<unknown>, label: string) {
  void operation.catch((error) =>
    voiceError('SIDEBAND_ERROR', { op: label, message: sanitizeLogText(String(error)) }),
  )
}

async function handleToolCall(
  ws: WebSocket,
  ctx: SidebandContext,
  action: RealtimeToolAction,
  state: SessionState,
  scheduleHangupFallback: () => void,
) {
  const args = parseArguments(action.argumentsJson)
  const startedAt = Date.now()
  markTimeline(ctx.timeline, 'tool_call_started', startedAt)
  voiceLog('TOOL_CALL_STARTED', { tool: action.name })

  // Nothing in the conversation depends on this status; the console's live
  // view reads it, and the stale-call reconciler already treats `waiting_tool`
  // and `live` identically. It does not belong in front of the caller.
  detach(
    db.update(call).set({ status: 'waiting_tool' }).where(eq(call.id, ctx.callRecordId)),
    'status:waiting_tool',
  )

  const result = args
    ? await executeTool(
        {
          callId: ctx.callRecordId,
          workspaceId: ctx.workspaceId,
          callerNumber: ctx.callerNumber,
          transferTo: ctx.transferTo,
          referCall: (destination) => referCall(ctx.externalCallId, destination),
        },
        action.name,
        args,
        { executionId: stableId('tex', ctx.callRecordId, action.toolCallId) },
      )
    : await recordInvalidArguments(ctx, action)

  // The model gets its answer here, before any bookkeeping. Everything below
  // this line used to run first: a status read, a status write, and an event
  // insert — three more round trips of silence on the line.
  sendToolOutput(ws, action, result)
  const sentAt = Date.now()
  markTimeline(ctx.timeline, 'tool_output_sent', sentAt)
  voiceLog('TOOL_CALL_COMPLETED', {
    tool: action.name,
    success: result.ok,
    toolMs: sentAt - startedAt,
  })

  // One conditional write replaces the previous read-then-write pair.
  detach(
    db
      .update(call)
      .set({ status: 'live' })
      .where(and(eq(call.id, ctx.callRecordId), eq(call.status, 'waiting_tool'))),
    'status:live',
  )
  detach(
    recordEvent(ctx, 'tool_completed', action.toolCallId, {
      tool: action.name,
      success: result.ok,
      toolMs: sentAt - startedAt,
    }),
    'event:tool_completed',
  )

  if (action.name === 'end_call' && result.ok) {
    state.pendingHangup = true
    requestResponse(
      ws,
      state,
      'قل جملة وداع عربية قصيرة ومهنية واحدة فقط، ولا تسأل سؤالًا جديدًا. ستنتهي المكالمة بعد اكتمال صوتك.',
    )
    scheduleHangupFallback()
    return
  }
  requestResponse(ws, state)
}

async function handleAction(
  ws: WebSocket,
  ctx: SidebandContext,
  action: RealtimeAction,
  state: SessionState,
  requestHangup: () => Promise<void>,
) {
  if (action.kind === 'transcript') {
    await appendTranscript(ctx, action, state)
    return
  }

  // Tool actions are scheduled by handleMessage on their own ordered queue.
  if (action.kind === 'tool_call') return

  if (action.kind === 'lifecycle') {
    if (action.state === 'speech_stopped') state.turnStartedAt = Date.now()
    if (action.state === 'response_started') state.activeResponse = true
    if (action.state === 'response_started' && state.pendingHangup) {
      state.hangupResponseStarted = true
    }

    // First audio. This is where a turn's latency is decided, and where the
    // call's own `first_audio_started` mark comes from.
    if (action.state === 'output_audio_started') {
      markTimeline(ctx.timeline, 'first_audio_started')
      if (state.turnStartedAt !== null) {
        const latencyMs = Math.max(0, Date.now() - state.turnStartedAt)
        if (action.responseId) state.turnLatencyByResponse.set(action.responseId, latencyMs)
        state.turnStartedAt = null
        voiceLog('TURN_LATENCY', { responseId: action.responseId, firstAudioMs: latencyMs })
      }
    }

    if (action.state === 'response_finished') {
      state.activeResponse = false
      if (state.pendingResponseInstructions !== null) {
        const instructions = state.pendingResponseInstructions || undefined
        state.pendingResponseInstructions = null
        requestResponse(ws, state, instructions)
      }
    }
    if (
      action.state === 'output_audio_stopped' &&
      state.pendingHangup &&
      state.hangupResponseStarted
    ) {
      await requestHangup()
    }
    if (action.state === 'connected') {
      await mergeCallMetadata(ctx, {
        sideband: {
          state: 'connected',
          connectedAt: new Date().toISOString(),
          ...(ctx.resumed ? { resumed: true } : {}),
        },
      })
      await recordEvent(ctx, 'sideband_connected', action.sourceId)
    }
    return
  }

  if (action.kind === 'usage') {
    state.inputTokens += action.inputTokens
    state.outputTokens += action.outputTokens
    return
  }

  const safeMessage = sanitizeLogText(action.message)
  state.lastRealtimeError = { code: action.code, message: safeMessage }
  await recordEvent(ctx, 'realtime_error', action.sourceId, {
    code: action.code,
    message: safeMessage,
  })
  voiceError('SIDEBAND_ERROR', {
    callId: maskIdentifier(ctx.externalCallId),
    code: action.code,
    message: safeMessage,
  })
}

async function handleMessage(
  ws: WebSocket,
  ctx: SidebandContext,
  data: RawData,
  state: SessionState,
  recording: RealtimeRecordingCapture | null,
  scheduleToolCall: (action: RealtimeToolAction) => void,
  requestHangup: () => Promise<void>,
) {
  let event: unknown
  try {
    event = JSON.parse(data.toString())
  } catch {
    await recordEvent(ctx, 'realtime_error', `invalid-json:${Date.now()}`, {
      message: 'Realtime event was not valid JSON',
    })
    return
  }

  if (recording) {
    try {
      await recording.handleEvent(ws, event)
    } catch {
      recording.noteWarning('capture_event_failed')
      voiceError('RECORDING_EVENT_FAILED', {
        callId: maskIdentifier(ctx.externalCallId),
      })
    }
  }

  for (const action of actionsFromRealtimeEvent(event)) {
    if (action.kind === 'tool_call') {
      scheduleToolCall(action)
      continue
    }
    await handleAction(ws, ctx, action, state, requestHangup)
  }
}

async function finalizeCall(
  ctx: SidebandContext,
  code: number,
  reason: Buffer,
  state: SessionState,
  socketError: string | null,
  leaseOwner: string,
) {
  markTimeline(ctx.timeline, 'sideband_closed')

  // A handover is not an ending. This process is being replaced while the
  // caller is still on the line: the lease has already been released so the
  // next process can reclaim the call immediately, and writing an end time or
  // a final status here would close a call that is still happening.
  if (state.handedOff) {
    voiceLog('SIDEBAND_CLOSED', { code, handedOff: true })
    await persistTimeline(ctx).catch(() => undefined)
    return
  }

  await compactCallTranscript(ctx.callRecordId)
  const endedAt = new Date()
  const normalClose = NORMAL_CLOSE_CODES.has(code)
  const [row] = await db
    .select({ status: call.status, metadata: call.metadata, startedAt: call.startedAt })
    .from(call)
    .where(eq(call.id, ctx.callRecordId))
    .limit(1)
  if (!row) return

  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - row.startedAt.getTime()) / 1000),
  )
  // A code-1006 abnormal closure never carries a close-frame reason (there was
  // no close frame) — the only place the actual transport error shows up is
  // the socket's own 'error' event, captured below and threaded in here.
  const diagnostic = resolveSidebandCloseDiagnostic({
    code,
    frameReason: sanitizeLogText(reason.toString()) || null,
    socketError,
    realtimeError: state.lastRealtimeError,
  })
  const closeReason = diagnostic.closeReason
  const previousSideband = asRecord(row.metadata?.sideband) ?? {}
  const completedMedia = normalClose || state.hangupSucceeded || state.hasConversation
  const cleanEnd = normalClose || state.hangupSucceeded
  const status = cleanEnd ? 'completed' : completedMedia ? 'completed_no_transcript' : 'failed'

  await db
    .update(call)
    .set({
      status,
      endedAt,
      durationSeconds,
      inputTokens: state.inputTokens > 0 ? state.inputTokens : null,
      outputTokens: state.outputTokens > 0 ? state.outputTokens : null,
      metadata: {
        ...(row.metadata ?? {}),
        ...(ctx.timeline ? { timeline: timelineSnapshot(ctx.timeline) } : {}),
        sideband: {
          ...previousSideband,
          state: cleanEnd ? 'ended' : 'disconnected',
          closedAt: endedAt.toISOString(),
          closeCode: code,
          closeReason,
          ...(diagnostic.realtimeError ? { realtimeError: diagnostic.realtimeError } : {}),
        },
      },
    })
    .where(eq(call.id, ctx.callRecordId))

  await recordEvent(ctx, 'sideband_closed', `close:${code}:${endedAt.toISOString()}`, {
    normal: cleanEnd,
    code,
  })
  // `closeCode` is emitted as its own field so the rate of abnormal closures
  // — the 1006s the ping in `runSideband` was added to chase — can finally be
  // counted from the log stream instead of guessed at.
  voiceLog('SIDEBAND_CLOSED', {
    normal: cleanEnd,
    closeCode: code,
    closeReason,
    durationSeconds,
    ...(ctx.timeline ? { timeline: timelineSnapshot(ctx.timeline) } : {}),
  })
  await finishSidebandJob(ctx, leaseOwner, completedMedia, closeReason)

  // This stays behind the already-finished call. The caller is never kept on
  // the line while the operational summary is produced.
  if (completedMedia) await enqueueCallIntelligence(ctx.callRecordId)

  if (!completedMedia) {
    await tryNotify(async () => {
      await Promise.all([
        notifyOperators({
          workspaceId: ctx.workspaceId,
          roles: ['owner', 'ops'],
          severity: 'critical',
          category: 'call',
          title: 'انقطعت قناة التحكم في مكالمة',
          message: 'تحتاج المكالمة مراجعة سجل الأحداث قبل متابعة العميل.',
          href: `/console/calls?call=${encodeURIComponent(ctx.callRecordId)}`,
          sourceType: 'call',
          sourceId: ctx.callRecordId,
          dedupeKey: `call:${ctx.callRecordId}:sideband:${code}`,
        }),
        notifyWorkspaceMembers({
          workspaceId: ctx.workspaceId,
          roles: ['client_admin', 'client_manager'],
          severity: 'warning',
          category: 'call',
          title: 'مكالمة تحتاج مراجعة',
          message: 'رصدنا انقطاعًا أثناء المكالمة، وفريق التشغيل يتابعها.',
          href: '/portal/calls',
          sourceType: 'call',
          sourceId: ctx.callRecordId,
          dedupeKey: `call:${ctx.callRecordId}:sideband:${code}`,
        }),
      ])
    })
  }
}

async function runSideband(ctx: SidebandContext, leaseOwner: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    voiceError('SIDEBAND_ERROR', 'OPENAI_API_KEY is not configured')
    return
  }

  voiceLog('SIDEBAND_CONNECTING', { resumed: Boolean(ctx.resumed) })

  // The socket is opened first and nothing is awaited before it.
  //
  // Recording preparation used to run here — a `workspace` select and a `call`
  // update — and it ran *before* `new WebSocket`, so two database round trips
  // sat between OpenAI answering the call and this process being able to ask
  // for the greeting. The caller heard every millisecond of that as silence.
  // It is now started after the greeting has been requested, and the message
  // handler waits on the promise instead: because handlers run on a serialised
  // queue, no event can overtake it and nothing is dropped.
  const url = `${REALTIME_WS}?call_id=${encodeURIComponent(ctx.externalCallId)}`
  const connectStartTime = Date.now()
  let ttfbMeasured = false
  let recordingPromise: Promise<RealtimeRecordingCapture | null> | null = null
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const state: SessionState = {
    turnStartedAt: null,
    turnLatencyByResponse: new Map(),
    handedOff: false,
    lastRealtimeError: null,
    seenToolCalls: new Set(),
    inputTokens: 0,
    outputTokens: 0,
    activeResponse: false,
    pendingResponseInstructions: null,
    pendingHangup: false,
    hangupResponseStarted: false,
    hangupRequested: false,
    hangupSucceeded: false,
    hasConversation: false,
  }
  let queue = Promise.resolve()
  let toolQueue = Promise.resolve()
  let hangupFallback: ReturnType<typeof setTimeout> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * The circuit breaker `overCapacity` cannot be: that check counts calls,
   * not minutes, so a workspace under its call limit can still hold one call
   * open indefinitely. This ends it the same way the agent's own `end_call`
   * tool does — `hangupCall` against the same OpenAI endpoint — rather than
   * `ws.terminate()`, which would sever the control channel mid-conversation
   * and leave the caller talking to a line that has already gone silent on
   * our end without ever being told the call ended.
   *
   * Deliberately independent of `requestHangup`'s state machine: that
   * function is for the agent's own decision to end the call, gated on
   * `state.pendingHangup`. This is the platform overriding a call nobody
   * ended, and it must fire whether or not the agent ever asked to hang up.
   */
  const forceEndOnMaxDuration = async () => {
    voiceError('CALL_MAX_DURATION_REACHED', {
      callId: maskIdentifier(ctx.externalCallId),
      maxMinutes: Math.round(MAX_CALL_DURATION_MS / 60_000),
    })
    const succeeded = await hangupCall(ctx.externalCallId)
    await recordEvent(ctx, succeeded ? 'call_hangup_requested' : 'call_hangup_failed', 'end_call', {
      success: succeeded,
      reason: 'max_duration',
    })
  }

  const requestHangup = async () => {
    if (state.hangupRequested || !state.pendingHangup) return
    state.hangupRequested = true
    const succeeded = await hangupCall(ctx.externalCallId)
    state.hangupSucceeded = succeeded
    await recordEvent(ctx, succeeded ? 'call_hangup_requested' : 'call_hangup_failed', 'end_call', {
      success: succeeded,
    })
    voiceLog(succeeded ? 'CALL_HANGUP_REQUESTED' : 'CALL_HANGUP_FAILED', {
      callId: maskIdentifier(ctx.externalCallId),
    })
    if (!succeeded) state.hangupRequested = false
  }
  const scheduleHangupFallback = () => {
    if (hangupFallback) clearTimeout(hangupFallback)
    hangupFallback = setTimeout(() => void requestHangup(), HANGUP_FALLBACK_MS)
    hangupFallback.unref()
  }
  const scheduleToolCall = (action: RealtimeToolAction) => {
    if (state.seenToolCalls.has(action.toolCallId)) return
    state.seenToolCalls.add(action.toolCallId)
    toolQueue = toolQueue
      .then(() => handleToolCall(ws, ctx, action, state, scheduleHangupFallback))
      .catch((error) => voiceError('SIDEBAND_ERROR', sanitizeLogText(String(error))))
  }
  const heartbeat = setInterval(() => {
    void db
      .update(backgroundJob)
      .set({ lockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(backgroundJob.id, sidebandJobId(ctx.externalCallId)),
          sql`${backgroundJob.payload}->>'leaseOwner' = ${leaseOwner}`,
        ),
      )
      .catch(() =>
        voiceError('SIDEBAND_ERROR', {
          callId: maskIdentifier(ctx.externalCallId),
          message: 'sideband lease heartbeat failed',
        }),
      )
    // Recurring production evidence (code 1006, no close frame, no socket
    // error — durations from 22s to 244s, first seen 2026-08-22) points at an
    // idle/unresponsive connection being reaped somewhere between this
    // process and OpenAI, not an application-level error on either side.
    // Nothing here previously sent a frame unless the model or caller spoke,
    // so a quiet stretch of a live call looked identical to a dead socket to
    // any intermediary watching for traffic. A ping is a real frame either
    // way — it now proves the connection is alive on quiet turns too, and
    // gives the earliest possible signal if it genuinely already died.
    if (ws.readyState === WebSocket.OPEN) ws.ping()
  }, 15_000)
  heartbeat.unref()

  let socketError: string | null = null

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => ws.terminate(), CONNECT_TIMEOUT_MS)

    ws.on('open', () => {
      clearTimeout(timeout)
      markTimeline(ctx.timeline, 'sideband_ws_opened')
      voiceLog('SIDEBAND_CONNECTED', { wsConnectMs: Date.now() - connectStartTime })
      activeSockets.set(ctx.externalCallId, { ws, ctx, state, leaseOwner })
      maxDurationTimer = setTimeout(() => void forceEndOnMaxDuration(), MAX_CALL_DURATION_MS)
      maxDurationTimer.unref()

      if (shouldSendInitialGreeting(ctx)) {
        ws.send(JSON.stringify(initialGreetingEvent()))
        state.activeResponse = true
        markTimeline(ctx.timeline, 'greeting_response_created')
        voiceLog('GREETING_REQUESTED')
      } else {
        // Reattaching to a conversation already under way. Asking for a
        // response here made the agent repeat its opening line mid-call.
        voiceLog('SIDEBAND_RESUMED', { greetingSuppressed: true })
      }

      // Only now, with the greeting already on the wire.
      recordingPromise = startRealtimeRecording({
        callRecordId: ctx.callRecordId,
        externalCallId: ctx.externalCallId,
        workspaceId: ctx.workspaceId,
        startedAt: ctx.startedAt,
      }).catch(() => {
        voiceError('RECORDING_FAILED', { code: 'recording_start_failed' })
        return null
      })

      detach(persistTimeline(ctx), 'timeline:opened')
    })

    ws.on('message', (data) => {
      if (!ttfbMeasured) {
        ttfbMeasured = true
        voiceLog('LATENCY_MEASURED', { sidebandTtfbMs: Date.now() - connectStartTime })
      }
      queue = queue
        .then(async () => {
          const recording = recordingPromise ? await recordingPromise : null
          await handleMessage(ws, ctx, data, state, recording, scheduleToolCall, requestHangup)
        })
        .catch((error) => {
          voiceError('SIDEBAND_ERROR', sanitizeLogText(String(error)))
        })
    })

    ws.on('error', (error) => {
      socketError = sanitizeLogText(String(error?.message ?? error))
      voiceError('SIDEBAND_ERROR', {
        callId: maskIdentifier(ctx.externalCallId),
        message: socketError,
      })
    })

    ws.on('close', (code, reason) => {
      clearTimeout(timeout)
      clearInterval(heartbeat)
      if (hangupFallback) clearTimeout(hangupFallback)
      if (maxDurationTimer) clearTimeout(maxDurationTimer)
      activeSockets.delete(ctx.externalCallId)
      queue = queue
        .then(() => toolQueue)
        .then(() => finalizeCall(ctx, code, reason, state, socketError, leaseOwner))
        .then(async () => {
          const recording = recordingPromise ? await recordingPromise : null
          await recording?.finalize()
        })
        .catch((error) => voiceError('SIDEBAND_ERROR', sanitizeLogText(String(error))))
        .finally(resolve)
    })
  })
}

export type SidebandClaim = { leaseOwner: string }

/**
 * Takes the lease for a call's control channel without opening it yet.
 *
 * Split out so the inbound webhook can run this concurrently with OpenAI's
 * accept call. The claim is a database write that does not depend on the
 * accept's outcome, so making it wait for the accept only added its latency to
 * the silence the caller hears before the greeting.
 */
export async function claimRealtimeSideband(ctx: SidebandContext): Promise<SidebandClaim | null> {
  const leaseOwner = randomUUID()
  return (await claimSideband(ctx, leaseOwner)) ? { leaseOwner } : null
}

/**
 * Gives back a claim whose call never started — OpenAI refused the accept.
 *
 * Closing the job matters: left `running`, it would go stale after two minutes
 * and `recoverStaleSidebands` would then try to open a control channel for a
 * call that does not exist.
 */
export async function releaseSidebandClaim(ctx: SidebandContext, claim: SidebandClaim) {
  await finishSidebandJob(ctx, claim.leaseOwner, false, 'accept_failed').catch(() => undefined)
}

/**
 * Starts one control channel for an accepted SIP call. Media transport stays
 * directly between OpenAI and SIP; when private recording storage is enabled,
 * this monitoring socket also persists the Realtime audio representations.
 *
 * Pass a `claim` obtained earlier from `claimRealtimeSideband` to keep this
 * synchronous up to `new WebSocket`; without one it claims the lease itself,
 * which is right for recovery but adds a round trip on the answer path.
 */
export async function startRealtimeSideband(
  ctx: SidebandContext,
  claim?: SidebandClaim | null,
): Promise<boolean> {
  const acquired = claim ?? (await claimRealtimeSideband(ctx))
  if (!acquired) {
    // Someone else owns this call. Give the concurrency slot straight back,
    // otherwise a redelivered webhook would permanently consume capacity.
    ctx.slot?.release()
    return false
  }
  const leaseOwner = acquired.leaseOwner

  // Offsets are measured from the webhook's arrival when it handed one over,
  // and from the call's own start otherwise (recovery, where no webhook ran).
  ctx.timeline = ctx.timeline ?? createTimeline(ctx.startedAt.getTime())

  // Everything below inherits this call's identity, so every line the socket
  // logs carries `callId` without the call site passing it.
  void withCallContext(
    {
      callId: ctx.callRecordId,
      externalCallId: maskIdentifier(ctx.externalCallId),
      workspaceId: ctx.workspaceId,
      timeline: ctx.timeline,
    },
    () => runSideband(ctx, leaseOwner),
  )
    .catch(async (error) => {
      const message = sanitizeLogText(String(error))
      voiceError('SIDEBAND_ERROR', message)
      await finishSidebandJob(ctx, leaseOwner, false, message).catch(() => undefined)
    })
    .finally(() => ctx.slot?.release())
  return true
}

export async function recoverStaleSidebands(limit = 2) {
  const staleBefore = new Date(Date.now() - SIDEBAND_LEASE_MS)
  const jobs = await db
    .select({ payload: backgroundJob.payload })
    .from(backgroundJob)
    .where(
      and(
        eq(backgroundJob.type, 'realtime_sideband'),
        or(
          inArray(backgroundJob.status, ['pending']),
          and(eq(backgroundJob.status, 'running'), lt(backgroundJob.lockedAt, staleBefore)),
        ),
      ),
    )
    .limit(limit)

  for (const job of jobs) {
    const payload = job.payload
    if (
      typeof payload.callRecordId !== 'string' ||
      typeof payload.externalCallId !== 'string' ||
      typeof payload.workspaceId !== 'string' ||
      typeof payload.startedAt !== 'string'
    ) {
      continue
    }

    // A recovered call occupies a slot exactly like a new one. If the process
    // is already full, leaving it for the next tick is correct — taking it
    // would put this instance over the limit it just refused new calls for.
    const admission = acquireCallSlot()
    if (!admission.ok) {
      voiceLog('ADMISSION_REFUSED', {
        stage: 'recovery',
        reason: admission.reason,
        active: admission.active,
        limit: admission.limit,
      })
      return
    }

    await startRealtimeSideband({
      callRecordId: payload.callRecordId,
      externalCallId: payload.externalCallId,
      workspaceId: payload.workspaceId,
      callerNumber:
        typeof payload.callerNumberProtected === 'string'
          ? revealString(payload.callerNumberProtected)
          : null,
      transferTo:
        typeof payload.transferToProtected === 'string'
          ? revealString(payload.transferToProtected)
          : null,
      startedAt: new Date(payload.startedAt),
      // The call is already under way; the agent must not greet again.
      resumed: true,
      slot: admission.slot,
    })
  }
}
