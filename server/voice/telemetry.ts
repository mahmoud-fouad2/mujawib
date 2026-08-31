import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Per-call timing, and the ambient call identity every log line inherits.
 *
 * Two problems this exists to solve, both found by the 2026-09-01 audit:
 *
 *  1. Nothing recorded when anything happened. The only latency number in the
 *     system was computed in `appendTranscript` from
 *     `response.output_audio_transcript.done` — an event that fires *after the
 *     agent has finished speaking*, so the stored value was "response latency
 *     plus the entire spoken reply". Every mark below is taken from an event
 *     that means what its name says, and `first_audio_started` in particular
 *     comes from `output_audio_buffer.started`, which is the moment the caller
 *     actually starts hearing something.
 *
 *  2. A log line could not be tied to a call. `voiceLog` masked identifiers
 *     but most call sites never passed one, so no `callId` could be grepped
 *     end to end. The context below is set once per call and read by
 *     `server/voice/log.ts`, so every line inside that scope carries it
 *     without the call site having to remember.
 *
 * Offsets are milliseconds from `originMs` (the instant the webhook arrived),
 * not absolute timestamps: they are what a reader actually wants, they survive
 * being read in another timezone, and they keep the persisted object small.
 */

/**
 * The stages worth timing on the call-setup path and inside a live call.
 *
 * A closed set rather than free-form strings: these names end up as keys in
 * `call.metadata.timeline`, and a typo in one of them would silently create a
 * second, near-identical field that no query knows to look for.
 */
export const CALL_MARKS = [
  'webhook_received',
  'signature_verified',
  'route_resolved',
  'capacity_checked',
  'call_reserved',
  'accept_request_started',
  'accept_response_received',
  'sideband_ws_opened',
  'greeting_response_created',
  'first_audio_started',
  // First tool call only — the call-level timeline answers "when did this call
  // first do work", while every individual invocation's own timing already
  // lives in `tool_execution.latency_ms` and in the per-call log lines.
  'tool_call_started',
  'tool_output_sent',
  'sideband_closed',
] as const

export type CallMark = (typeof CALL_MARKS)[number]

export type CallTimeline = {
  /** Milliseconds since the epoch for offset 0 — the webhook's own arrival. */
  originMs: number
  marks: Partial<Record<CallMark, number>>
}

export function createTimeline(originMs: number = Date.now()): CallTimeline {
  return { originMs, marks: {} }
}

/**
 * Records one mark and returns its offset.
 *
 * First write wins. A webhook redelivery or a reconnect can drive the same
 * stage twice, and the first occurrence is the one that describes what the
 * caller experienced — overwriting it would quietly turn a 300ms setup into
 * whatever the retry happened to cost.
 */
export function markTimeline(
  timeline: CallTimeline | null | undefined,
  mark: CallMark,
  at: number = Date.now(),
): number | null {
  if (!timeline) return null
  const offset = Math.max(0, at - timeline.originMs)
  if (timeline.marks[mark] === undefined) timeline.marks[mark] = offset
  return timeline.marks[mark] ?? offset
}

/** The marks so far, plus derived spans, ready to persist as JSON. */
export function timelineSnapshot(timeline: CallTimeline): Record<string, number | string> {
  const marks = timeline.marks
  const snapshot: Record<string, number | string> = {
    originAt: new Date(timeline.originMs).toISOString(),
    ...marks,
  }

  const span = (from: CallMark, to: CallMark) => {
    const start = marks[from]
    const end = marks[to]
    return start === undefined || end === undefined ? null : Math.max(0, end - start)
  }

  // The two numbers an operator actually asks for. `answerMs` is how long
  // OpenAI took to accept; `firstAudioMs` is the dead air the caller heard
  // between being answered and hearing a voice — the number the audit
  // identified as the single most-felt latency in the product.
  const answerMs = span('accept_request_started', 'accept_response_received')
  const firstAudioMs = span('accept_response_received', 'first_audio_started')
  if (answerMs !== null) snapshot.answerMs = answerMs
  if (firstAudioMs !== null) snapshot.firstAudioMs = firstAudioMs
  if (marks.first_audio_started !== undefined) {
    snapshot.timeToFirstAudioMs = marks.first_audio_started
  }

  return snapshot
}

/* ─── ambient call identity ──────────────────────────────────────────────── */

export type CallLogContext = {
  /** MUJAWIB's own call row id — the one an operator pastes into the console. */
  callId: string | null
  /** Already masked by the caller; never the raw provider identifier. */
  externalCallId: string | null
  workspaceId: string | null
  timeline: CallTimeline | null
}

const storage = new AsyncLocalStorage<CallLogContext>()

/** Runs `fn` with every `voiceLog`/`voiceError` inside it tagged with this call. */
export function withCallContext<T>(context: CallLogContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function currentCallContext(): CallLogContext | undefined {
  return storage.getStore()
}

/**
 * Fills in the call row id once it exists.
 *
 * The webhook logs several stages before the row is reserved, so the context
 * has to be created without one and completed in place rather than replaced —
 * anything already running inside the scope keeps the same object.
 */
export function attachCallId(callId: string) {
  const context = storage.getStore()
  if (context) context.callId = callId
}

/** `masked` must already have been through `maskIdentifier`. */
export function attachExternalCallId(masked: string) {
  const context = storage.getStore()
  if (context) context.externalCallId = masked
}

export function attachWorkspaceId(workspaceId: string) {
  const context = storage.getStore()
  if (context) context.workspaceId = workspaceId
}

export function currentTimeline(): CallTimeline | null {
  return storage.getStore()?.timeline ?? null
}

/** Marks against the ambient call, for code with no timeline in hand. */
export function mark(name: CallMark, at: number = Date.now()): number | null {
  return markTimeline(currentTimeline(), name, at)
}
