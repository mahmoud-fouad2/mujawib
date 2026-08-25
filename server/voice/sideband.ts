import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import WebSocket, { type RawData } from 'ws'
import { enqueueCallIntelligence } from '@/server/calls/intelligence'
import { db } from '@/server/db'
import { backgroundJob, call, callEvent, toolExecution } from '@/server/db/schema'
import { notifyOperators, notifyWorkspaceMembers, tryNotify } from '@/server/notifications/service'
import {
  protectJson,
  protectString,
  revealJson,
  revealString,
} from '@/server/security/protected-data'
import { executeTool } from '@/server/voice/handlers'
import { maskIdentifier, sanitizeLogText, voiceError, voiceLog } from '@/server/voice/log'
import {
  actionsFromRealtimeEvent,
  initialGreetingEvent,
  type RealtimeAction,
  type RealtimeToolAction,
  type RealtimeTranscriptAction,
} from '@/server/voice/realtime-events'
import type { ToolResult } from '@/server/voice/tools'

const REALTIME_WS = 'wss://api.openai.com/v1/realtime'
const OPENAI_API = 'https://api.openai.com/v1'
const CONNECT_TIMEOUT_MS = 10_000
const NORMAL_CLOSE_CODES = new Set([1000, 1005])

type SidebandContext = {
  callRecordId: string
  externalCallId: string
  workspaceId: string
  callerNumber: string | null
  transferTo: string | null
  startedAt: Date
}

type SessionState = {
  lastCallerSpeechStoppedAt: number | null
  seenToolCalls: Set<string>
  inputTokens: number
  outputTokens: number
}

function stableId(prefix: string, ...parts: string[]) {
  const digest = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 24)
  return `${prefix}_${digest}`
}

function sidebandJobId(externalCallId: string) {
  return stableId('job', 'sideband', externalCallId)
}

async function claimSideband(ctx: SidebandContext) {
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

  const staleBefore = new Date(now.getTime() - 45_000)
  const [reclaimed] = await db
    .update(backgroundJob)
    .set({
      status: 'running',
      lockedAt: now,
      attempts: sql`${backgroundJob.attempts} + 1`,
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

async function finishSidebandJob(ctx: SidebandContext, normal: boolean, reason: string | null) {
  await db
    .update(backgroundJob)
    .set({
      status: normal ? 'completed' : 'failed',
      completedAt: new Date(),
      lastError: normal ? null : reason,
      updatedAt: new Date(),
    })
    .where(eq(backgroundJob.id, sidebandJobId(ctx.externalCallId)))
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
) {
  await db
    .insert(callEvent)
    .values({
      id: stableId('cev', ctx.callRecordId, type, sourceId),
      callId: ctx.callRecordId,
      type,
      payload,
      ...(latencyMs === undefined ? {} : { latencyMs }),
      occurredAt: new Date(),
    })
    .onConflictDoNothing()
}

async function updateSidebandMetadata(ctx: SidebandContext, sideband: Record<string, unknown>) {
  const [row] = await db
    .select({ metadata: call.metadata })
    .from(call)
    .where(eq(call.id, ctx.callRecordId))
    .limit(1)
  if (!row) return

  await db
    .update(call)
    .set({
      metadata: {
        ...(row.metadata ?? {}),
        sideband,
      },
    })
    .where(eq(call.id, ctx.callRecordId))
}

async function appendTranscript(
  ctx: SidebandContext,
  action: RealtimeTranscriptAction,
  state: SessionState,
) {
  const cleanText = action.text.replace(/\s+/g, ' ').trim().slice(0, 4_000)
  if (!cleanText) return

  const turnId = stableId('turn', ctx.callRecordId, action.role, action.sourceId)
  const [row] = await db
    .select({ transcript: call.transcript, transcriptEncrypted: call.transcriptEncrypted })
    .from(call)
    .where(eq(call.id, ctx.callRecordId))
    .limit(1)
  if (!row) return

  const transcript = revealJson<unknown[]>(
    row.transcriptEncrypted,
    Array.isArray(row.transcript) ? row.transcript : [],
  )
  const alreadyStored = transcript.some((turn) => asRecord(turn)?.sourceId === turnId)
  if (alreadyStored) return

  const at = Math.max(0, (Date.now() - ctx.startedAt.getTime()) / 1000)
  await db
    .update(call)
    .set({
      transcript: [],
      transcriptEncrypted: protectJson([
        ...transcript,
        { role: action.role, text: cleanText, at, sourceId: turnId },
      ]),
    })
    .where(eq(call.id, ctx.callRecordId))

  const latencyMs =
    action.role === 'agent' && state.lastCallerSpeechStoppedAt
      ? Math.max(0, Date.now() - state.lastCallerSpeechStoppedAt)
      : undefined

  await recordEvent(
    ctx,
    action.role === 'agent' ? 'agent_turn' : 'caller_turn',
    turnId,
    {
      role: action.role,
      characters: cleanText.length,
      sourceEvent: action.eventType,
    },
    latencyMs,
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
  ws.send(JSON.stringify({ type: 'response.create' }))
}

async function handleToolCall(
  ws: WebSocket,
  ctx: SidebandContext,
  action: RealtimeToolAction,
  state: SessionState,
) {
  if (state.seenToolCalls.has(action.toolCallId)) return
  state.seenToolCalls.add(action.toolCallId)

  const args = parseArguments(action.argumentsJson)
  voiceLog('TOOL_CALL_STARTED', {
    callId: maskIdentifier(ctx.externalCallId),
    tool: action.name,
  })
  await db.update(call).set({ status: 'waiting_tool' }).where(eq(call.id, ctx.callRecordId))

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

  const [current] = await db
    .select({ status: call.status })
    .from(call)
    .where(eq(call.id, ctx.callRecordId))
    .limit(1)
  if (current?.status === 'waiting_tool') {
    await db.update(call).set({ status: 'live' }).where(eq(call.id, ctx.callRecordId))
  }

  await recordEvent(ctx, 'tool_completed', action.toolCallId, {
    tool: action.name,
    success: result.ok,
  })
  voiceLog('TOOL_CALL_COMPLETED', {
    callId: maskIdentifier(ctx.externalCallId),
    tool: action.name,
    success: result.ok,
  })
  sendToolOutput(ws, action, result)
}

async function handleAction(
  ws: WebSocket,
  ctx: SidebandContext,
  action: RealtimeAction,
  state: SessionState,
) {
  if (action.kind === 'transcript') {
    await appendTranscript(ctx, action, state)
    return
  }

  if (action.kind === 'tool_call') {
    await handleToolCall(ws, ctx, action, state)
    return
  }

  if (action.kind === 'lifecycle') {
    if (action.state === 'speech_stopped') state.lastCallerSpeechStoppedAt = Date.now()
    if (action.state === 'connected') {
      await updateSidebandMetadata(ctx, {
        state: 'connected',
        connectedAt: new Date().toISOString(),
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

  for (const action of actionsFromRealtimeEvent(event)) {
    await handleAction(ws, ctx, action, state)
  }
}

async function finalizeCall(
  ctx: SidebandContext,
  code: number,
  reason: Buffer,
  state: SessionState,
) {
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
  const closeReason = sanitizeLogText(reason.toString()) || null
  const previousSideband = asRecord(row.metadata?.sideband) ?? {}
  const status = normalClose ? 'completed' : 'failed'

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
        sideband: {
          ...previousSideband,
          state: normalClose ? 'ended' : 'disconnected',
          closedAt: endedAt.toISOString(),
          closeCode: code,
          closeReason,
        },
      },
    })
    .where(eq(call.id, ctx.callRecordId))

  await recordEvent(ctx, 'sideband_closed', `close:${code}:${endedAt.toISOString()}`, {
    normal: normalClose,
    code,
  })
  voiceLog('SIDEBAND_CLOSED', {
    callId: maskIdentifier(ctx.externalCallId),
    normal: normalClose,
    code,
  })
  await finishSidebandJob(ctx, normalClose, closeReason)

  // This stays behind the already-finished call. The caller is never kept on
  // the line while the operational summary is produced.
  if (normalClose) await enqueueCallIntelligence(ctx.callRecordId)

  if (!normalClose) {
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

async function runSideband(ctx: SidebandContext) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    voiceError('SIDEBAND_ERROR', 'OPENAI_API_KEY is not configured')
    return
  }

  voiceLog('SIDEBAND_CONNECTING', { callId: maskIdentifier(ctx.externalCallId) })
  const url = `${REALTIME_WS}?call_id=${encodeURIComponent(ctx.externalCallId)}`
  const connectStartTime = Date.now()
  let ttfbMeasured = false
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const state: SessionState = {
    lastCallerSpeechStoppedAt: null,
    seenToolCalls: new Set(),
    inputTokens: 0,
    outputTokens: 0,
  }
  let queue = Promise.resolve()
  const heartbeat = setInterval(() => {
    void db
      .update(backgroundJob)
      .set({ lockedAt: new Date(), updatedAt: new Date() })
      .where(eq(backgroundJob.id, sidebandJobId(ctx.externalCallId)))
  }, 15_000)
  heartbeat.unref()

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => ws.terminate(), CONNECT_TIMEOUT_MS)

    ws.on('open', () => {
      clearTimeout(timeout)
      voiceLog('SIDEBAND_CONNECTED', { callId: maskIdentifier(ctx.externalCallId) })
      ws.send(JSON.stringify(initialGreetingEvent()))
      voiceLog('GREETING_REQUESTED', { callId: maskIdentifier(ctx.externalCallId) })
    })

    ws.on('message', (data) => {
      if (!ttfbMeasured) {
        ttfbMeasured = true
        const latencyMs = Date.now() - connectStartTime
        voiceLog('LATENCY_MEASURED', {
          callId: maskIdentifier(ctx.externalCallId),
          ttfbMs: latencyMs,
        })
      }
      queue = queue
        .then(() => handleMessage(ws, ctx, data, state))
        .catch((error) => {
          voiceError('SIDEBAND_ERROR', sanitizeLogText(String(error)))
        })
    })

    ws.on('error', () => {
      voiceError('SIDEBAND_ERROR', {
        callId: maskIdentifier(ctx.externalCallId),
        message: 'control channel error',
      })
    })

    ws.on('close', (code, reason) => {
      clearTimeout(timeout)
      clearInterval(heartbeat)
      queue = queue
        .then(() => finalizeCall(ctx, code, reason, state))
        .catch((error) => voiceError('SIDEBAND_ERROR', sanitizeLogText(String(error))))
        .finally(resolve)
    })
  })
}

/**
 * Starts one control channel for an accepted SIP call. The call audio stays
 * directly between OpenAI and the SIP ingress; this socket only receives
 * private control events, executes tools, and persists verified evidence.
 */
export async function startRealtimeSideband(ctx: SidebandContext): Promise<boolean> {
  if (!(await claimSideband(ctx))) return false

  void runSideband(ctx).catch(async (error) => {
    const message = sanitizeLogText(String(error))
    voiceError('SIDEBAND_ERROR', message)
    await finishSidebandJob(ctx, false, message)
  })
  return true
}

export async function recoverStaleSidebands(limit = 2) {
  const staleBefore = new Date(Date.now() - 45_000)
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
    })
  }
}
