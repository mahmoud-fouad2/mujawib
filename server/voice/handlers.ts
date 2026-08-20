import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/server/db'
import {
  booking,
  call,
  changeRequest,
  integrationConnection,
  knowledgeItem,
  toolExecution,
} from '@/server/db/schema'
import type { ToolName, ToolResult } from '@/server/voice/tools'

/**
 * Tool execution for a live call.
 *
 * Bible §12: no business action is confirmed to the caller before its tool
 * returns a genuine success. That rule only means anything if the failure path
 * is real, so every handler here either does the thing or says plainly that it
 * could not — none of them returns an optimistic result to keep the
 * conversation moving.
 *
 * Every invocation is written to `tool_execution` with its latency and outcome,
 * which is what the console and QA read afterwards.
 */

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export type ToolContext = {
  callId: string
  workspaceId: string
  callerNumber: string | null
  transferTo: string | null
}

/** Looks up a connection and reports why it cannot be used, if it cannot. */
async function requireIntegration(workspaceId: string, providers: string[]) {
  const rows = await db
    .select()
    .from(integrationConnection)
    .where(eq(integrationConnection.workspaceId, workspaceId))

  const match = rows.find((r) => providers.includes(r.provider))
  if (!match) return { ok: false as const, reason: 'not_configured' as const }
  if (match.health === 'failed' || match.health === 'disconnected') {
    return { ok: false as const, reason: 'unhealthy' as const }
  }
  return { ok: true as const, connection: match }
}

/* ─── check_availability ─────────────────────────────────────────────────── */

async function checkAvailability(
  ctx: ToolContext,
  args: { service?: string; preferredDate?: string; preferredPeriod?: string; branch?: string },
): Promise<ToolResult> {
  const integration = await requireIntegration(ctx.workspaceId, [
    'google_calendar',
    'microsoft_365',
  ])

  if (!integration.ok) {
    return {
      ok: false,
      error:
        integration.reason === 'not_configured'
          ? 'لا يوجد تقويم مربوط بهذا الحساب.'
          : 'التقويم غير متاح حاليًا.',
      fallback: 'callback',
    }
  }

  // The service must exist in structured knowledge — Bible §12 forbids quoting
  // anything that is not recorded.
  const services = await db
    .select()
    .from(knowledgeItem)
    .where(
      and(eq(knowledgeItem.workspaceId, ctx.workspaceId), eq(knowledgeItem.category, 'service')),
    )

  const known = services.find((s) => args.service && s.title.includes(args.service))
  if (args.service && !known) {
    return {
      ok: false,
      error: 'هذه الخدمة غير مسجّلة لدى هذا العميل.',
      fallback: 'transfer',
    }
  }

  const config = (integration.connection.config ?? {}) as { availabilityUrl?: string }

  // Real calendar reads land here. Until an endpoint is configured we say so
  // rather than inventing slots the caller would then be promised.
  if (!config.availabilityUrl) {
    return {
      ok: false,
      error: 'التقويم مربوط لكن لم يُضبط مصدر المواعيد بعد.',
      fallback: 'callback',
    }
  }

  const response = await fetch(config.availabilityUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: args.service,
      date: args.preferredDate,
      period: args.preferredPeriod,
      branch: args.branch,
    }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => null)

  if (!response?.ok) {
    return { ok: false, error: 'تعذّر الوصول إلى التقويم.', fallback: 'callback' }
  }

  const data = (await response.json()) as { slots?: string[] }
  const slots = (data.slots ?? []).slice(0, 2) // Bible §15: two options, not a list

  if (slots.length === 0) {
    return { ok: false, error: 'لا توجد مواعيد متاحة في هذا اليوم.', fallback: 'retry' }
  }

  return { ok: true, data: { slots, service: known?.title ?? args.service } }
}

/* ─── create_booking ─────────────────────────────────────────────────────── */

async function createBooking(
  ctx: ToolContext,
  args: {
    service?: string
    slot?: string
    customerName?: string
    customerPhone?: string
    branch?: string
    notes?: string
  },
): Promise<ToolResult> {
  if (!args.slot || !args.customerName || !args.customerPhone) {
    return { ok: false, error: 'بيانات الحجز غير مكتملة.', fallback: 'retry' }
  }

  const integration = await requireIntegration(ctx.workspaceId, [
    'google_calendar',
    'microsoft_365',
  ])
  if (!integration.ok) {
    return { ok: false, error: 'لا يمكن تثبيت الحجز الآن.', fallback: 'callback' }
  }

  const config = (integration.connection.config ?? {}) as { bookingUrl?: string }
  if (!config.bookingUrl) {
    return { ok: false, error: 'لم يُضبط مسار إنشاء الحجز بعد.', fallback: 'callback' }
  }

  const response = await fetch(config.bookingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)

  if (!response?.ok) {
    return { ok: false, error: 'لم يتم تثبيت الحجز.', fallback: 'callback' }
  }

  const data = (await response.json()) as { bookingId?: string }

  // Only recorded once the upstream calendar confirmed it.
  const bookingId = id('bk')
  await db.insert(booking).values({
    id: bookingId,
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    externalId: data.bookingId ?? null,
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    service: args.service ?? null,
    scheduledAt: new Date(args.slot),
    status: 'confirmed',
    metadata: { branch: args.branch, notes: args.notes, source: 'voice' },
    createdAt: new Date(),
  })

  return { ok: true, data: { bookingId, slot: args.slot } }
}

/* ─── send_confirmation ──────────────────────────────────────────────────── */

async function sendConfirmation(
  ctx: ToolContext,
  args: { to?: string; bookingId?: string },
): Promise<ToolResult> {
  const integration = await requireIntegration(ctx.workspaceId, ['whatsapp'])
  if (!integration.ok) {
    // Not fatal: the booking already exists, so the call still succeeded.
    return { ok: false, error: 'تعذّر إرسال رسالة التأكيد.', fallback: 'retry' }
  }

  const config = (integration.connection.config ?? {}) as { sendUrl?: string }
  if (!config.sendUrl) {
    return { ok: false, error: 'لم يُضبط مسار الإرسال بعد.', fallback: 'retry' }
  }

  const response = await fetch(config.sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: args.to ?? ctx.callerNumber, bookingId: args.bookingId }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => null)

  if (!response?.ok) return { ok: false, error: 'لم تُرسل الرسالة.', fallback: 'retry' }
  return { ok: true, data: { sent: true } }
}

/* ─── create_callback ────────────────────────────────────────────────────── */

/** Always succeeds: it writes to our own database, so it is the safe fallback. */
async function createCallback(
  ctx: ToolContext,
  args: { customerName?: string; customerPhone?: string; reason?: string },
): Promise<ToolResult> {
  const now = new Date()
  await db.insert(changeRequest).values({
    id: id('cr'),
    workspaceId: ctx.workspaceId,
    type: 'callback',
    title: `معاودة اتصال — ${args.customerName ?? args.customerPhone ?? 'متصل'}`,
    description: args.reason ?? null,
    status: 'requested',
    requestedById: 'voice',
    metadata: {
      phone: args.customerPhone ?? ctx.callerNumber,
      name: args.customerName,
      callId: ctx.callId,
    },
    createdAt: now,
    updatedAt: now,
  })

  await db.update(call).set({ outcome: 'callback' }).where(eq(call.id, ctx.callId))
  return { ok: true, data: { logged: true } }
}

/* ─── transfer_to_human ──────────────────────────────────────────────────── */

async function transferToHuman(ctx: ToolContext, args: { reason?: string }): Promise<ToolResult> {
  if (!ctx.transferTo) {
    return { ok: false, error: 'لا يوجد رقم تحويل مضبوط.', fallback: 'callback' }
  }

  await db
    .update(call)
    .set({ status: 'transferred', outcome: 'transfer' })
    .where(eq(call.id, ctx.callId))

  // The SIP REFER itself is issued by the caller of this handler, which holds
  // the OpenAI call id; here we only record intent and the destination.
  return { ok: true, data: { transferTo: ctx.transferTo, reason: args.reason } }
}

/* ─── dispatcher ─────────────────────────────────────────────────────────── */

const HANDLERS: Record<
  ToolName,
  (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>
> = {
  check_availability: (ctx, a) => checkAvailability(ctx, a),
  create_booking: (ctx, a) => createBooking(ctx, a),
  send_confirmation: (ctx, a) => sendConfirmation(ctx, a),
  create_callback: (ctx, a) => createCallback(ctx, a),
  transfer_to_human: (ctx, a) => transferToHuman(ctx, a),
}

/**
 * Runs one tool call and records it. The returned value is what the model sees,
 * so a failure has to read as a business fact the agent can say out loud — not
 * a stack trace.
 */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const handler = HANDLERS[name as ToolName]
  const started = Date.now()

  if (!handler) {
    return { ok: false, error: 'أداة غير معروفة.', fallback: 'transfer' }
  }

  let result: ToolResult
  try {
    result = await handler(ctx, args)
  } catch (error) {
    console.error(`[voice] tool ${name} threw`, error)
    result = { ok: false, error: 'تعذّر تنفيذ الطلب.', fallback: 'callback' }
  }

  const latencyMs = Date.now() - started

  await db
    .insert(toolExecution)
    .values({
      id: id('tex'),
      callId: ctx.callId,
      toolName: name,
      request: args,
      result: result as unknown as Record<string, unknown>,
      success: String(result.ok),
      latencyMs,
      executedAt: new Date(),
    })
    .catch((error) => console.error('[voice] could not record tool execution', error))

  return result
}
