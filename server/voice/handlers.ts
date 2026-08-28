import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { upsertCustomerFromContact } from '@/server/crm/upsert'
import { db } from '@/server/db'
import { booking, call, changeRequest, knowledgeItem, toolExecution } from '@/server/db/schema'
import {
  findIntegration,
  type IntegrationFailureCode,
  invokeIntegration,
} from '@/server/integrations/runtime'
import { protectJson, protectString, revealJson } from '@/server/security/protected-data'
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
  operationId?: string
  /** The control channel owns SIP REFER; handlers only see a truthful result. */
  referCall?: (destination: string) => Promise<boolean>
}

export type ToolExecutionOptions = {
  /** Stable OpenAI function-call id, converted to a deterministic DB id upstream. */
  executionId?: string
}

function integrationError(code: IntegrationFailureCode, subject: string): string {
  if (code === 'not_configured') return `لم يكتمل إعداد ${subject} بعد.`
  if (code === 'credential_missing') return `يحتاج اتصال ${subject} إلى إعادة ربط آمنة.`
  if (code === 'invalid_response') return `أعاد ${subject} نتيجة غير مكتملة.`
  return `${subject} غير متاح حاليًا.`
}

const availabilityArgs = z.object({
  service: z.string().trim().min(1).max(160),
  preferredDate: z.string().trim().min(1).max(40),
  preferredPeriod: z.enum(['morning', 'afternoon', 'evening', 'any']).optional(),
  branch: z.string().trim().max(160).optional(),
})

const bookingArgs = z.object({
  service: z.string().trim().min(1).max(160),
  slot: z
    .string()
    .trim()
    .refine((value) => Number.isFinite(Date.parse(value))),
  customerName: z.string().trim().min(1).max(160),
  customerPhone: z.string().trim().min(7).max(30),
  branch: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  availabilityToken: z.string().trim().min(32).max(2_048),
})

const callbackArgs = z.object({
  customerName: z.string().trim().min(1).max(160).optional(),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,30}$/)
    .optional(),
  reason: z.string().trim().min(3).max(500),
})

function availabilityToken(ctx: ToolContext, service: string, slot: string) {
  const expiresAt = Date.now() + 10 * 60 * 1000
  const payload = Buffer.from(
    JSON.stringify({ callId: ctx.callId, workspaceId: ctx.workspaceId, service, slot, expiresAt }),
  ).toString('base64url')
  const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET as string)
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

function verifyAvailabilityToken(ctx: ToolContext, token: string, service: string, slot: string) {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = createHmac('sha256', process.env.BETTER_AUTH_SECRET as string)
    .update(payload)
    .digest('base64url')
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return false
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
    return (
      claims.callId === ctx.callId &&
      claims.workspaceId === ctx.workspaceId &&
      claims.service === service &&
      claims.slot === slot &&
      typeof claims.expiresAt === 'number' &&
      claims.expiresAt > Date.now()
    )
  } catch {
    return false
  }
}

const confirmationArgs = z.object({
  to: z.string().trim().min(7).max(30).optional(),
  bookingId: z.string().trim().min(1).max(200),
})

/* ─── check_availability ─────────────────────────────────────────────────── */

async function checkAvailability(
  ctx: ToolContext,
  args: { service?: string; preferredDate?: string; preferredPeriod?: string; branch?: string },
): Promise<ToolResult> {
  const parsed = availabilityArgs.safeParse(args)
  if (!parsed.success) {
    return { ok: false, error: 'بيانات البحث عن موعد غير مكتملة.', fallback: 'retry' }
  }

  const integration = await findIntegration(
    ctx.workspaceId,
    ['google_calendar', 'microsoft_365'],
    'availability',
  )

  if (!integration) {
    return {
      ok: false,
      error: 'لا يوجد تقويم مربوط بهذا الحساب.',
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

  const known = services.find((service) => service.title.includes(parsed.data.service))
  if (!known) {
    return {
      ok: false,
      error: 'هذه الخدمة غير مسجّلة لدى هذا العميل.',
      fallback: 'transfer',
    }
  }

  const response = await invokeIntegration<{ slots: string[] }>({
    connection: integration,
    action: 'availability',
    payload: {
      service: parsed.data.service,
      date: parsed.data.preferredDate,
      period: parsed.data.preferredPeriod,
      branch: parsed.data.branch,
    },
  })
  if (!response.ok) {
    return { ok: false, error: integrationError(response.code, 'التقويم'), fallback: 'callback' }
  }

  const slots = response.data.slots.slice(0, 2) // Bible §15: two options, not a list

  if (slots.length === 0) {
    return { ok: false, error: 'لا توجد مواعيد متاحة في هذا اليوم.', fallback: 'retry' }
  }

  return {
    ok: true,
    data: {
      service: known.title,
      slots: slots.map((slot) => ({
        slot,
        availabilityToken: availabilityToken(ctx, known.title, slot),
      })),
    },
  }
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
    availabilityToken?: string
  },
): Promise<ToolResult> {
  const parsed = bookingArgs.safeParse(args)
  if (!parsed.success) {
    return { ok: false, error: 'بيانات الحجز غير مكتملة.', fallback: 'retry' }
  }

  if (
    !verifyAvailabilityToken(
      ctx,
      parsed.data.availabilityToken,
      parsed.data.service,
      parsed.data.slot,
    )
  ) {
    return {
      ok: false,
      error: 'انتهت صلاحية الموعد أو لم يعد مطابقًا لنتيجة التحقق. أعد فحص المواعيد.',
      fallback: 'retry',
    }
  }

  const integration = await findIntegration(
    ctx.workspaceId,
    ['google_calendar', 'microsoft_365'],
    'booking',
  )
  if (!integration) {
    return { ok: false, error: 'لا يمكن تثبيت الحجز الآن.', fallback: 'callback' }
  }

  const response = await invokeIntegration<{ bookingId: string }>({
    connection: integration,
    action: 'booking',
    payload: {
      service: parsed.data.service,
      slot: parsed.data.slot,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      branch: parsed.data.branch,
      notes: parsed.data.notes,
      idempotencyKey: ctx.operationId ?? ctx.callId,
    },
  })
  if (!response.ok) {
    return { ok: false, error: integrationError(response.code, 'التقويم'), fallback: 'callback' }
  }

  // Only recorded once the upstream calendar confirmed it.
  const proposedBookingId = id('bk')
  const bookedAt = new Date()
  const bookingId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(booking)
      .values({
        id: proposedBookingId,
        workspaceId: ctx.workspaceId,
        callId: ctx.callId,
        externalId: response.data.bookingId,
        customerName: parsed.data.customerName,
        customerNameEncrypted: protectString(parsed.data.customerName),
        customerPhone: parsed.data.customerPhone,
        customerPhoneEncrypted: protectString(parsed.data.customerPhone),
        service: parsed.data.service,
        scheduledAt: new Date(parsed.data.slot),
        status: 'confirmed',
        metadata: { branch: parsed.data.branch, notes: parsed.data.notes, source: 'voice' },
        createdAt: bookedAt,
      })
      .onConflictDoNothing({ target: [booking.workspaceId, booking.externalId] })
      .returning({ id: booking.id })
    await tx.update(call).set({ outcome: 'booking' }).where(eq(call.id, ctx.callId))
    if (inserted) return inserted.id
    const [existing] = await tx
      .select({ id: booking.id })
      .from(booking)
      .where(
        and(
          eq(booking.workspaceId, ctx.workspaceId),
          eq(booking.externalId, response.data.bookingId),
        ),
      )
      .limit(1)
    if (!existing) throw new Error('booking result could not be reconciled')
    return existing.id
  })

  await upsertCustomerFromContact({
    workspaceId: ctx.workspaceId,
    phone: parsed.data.customerPhone,
    name: parsed.data.customerName,
    when: bookedAt,
  }).catch(() => console.error('[voice] could not upsert CRM contact from booking'))

  return { ok: true, data: { bookingId, slot: parsed.data.slot } }
}

/* ─── send_confirmation ──────────────────────────────────────────────────── */

async function sendConfirmation(
  ctx: ToolContext,
  args: { to?: string; bookingId?: string },
): Promise<ToolResult> {
  const parsed = confirmationArgs.safeParse(args)
  if (!parsed.success || (!parsed.data.to && !ctx.callerNumber)) {
    return { ok: false, error: 'بيانات إرسال التأكيد غير مكتملة.', fallback: 'retry' }
  }

  const integration = await findIntegration(ctx.workspaceId, ['whatsapp'], 'message')
  if (!integration) {
    // Not fatal: the booking already exists, so the call still succeeded.
    return { ok: false, error: 'تعذّر إرسال رسالة التأكيد.', fallback: 'retry' }
  }

  const response = await invokeIntegration({
    connection: integration,
    action: 'message',
    payload: { to: parsed.data.to ?? ctx.callerNumber, bookingId: parsed.data.bookingId },
  })
  if (!response.ok) {
    return { ok: false, error: integrationError(response.code, 'قناة الإرسال'), fallback: 'retry' }
  }
  return { ok: true, data: { sent: true } }
}

/* ─── create_callback ────────────────────────────────────────────────────── */

async function createCallback(
  ctx: ToolContext,
  args: { customerName?: string; customerPhone?: string; reason?: string },
): Promise<ToolResult> {
  const parsed = callbackArgs.safeParse({
    ...args,
    customerPhone: args.customerPhone ?? ctx.callerNumber ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'بيانات معاودة الاتصال غير مكتملة.', fallback: 'retry' }
  }

  const now = new Date()
  const requestId = id('cr')
  const [inserted] = await db
    .insert(changeRequest)
    .values({
      id: requestId,
      workspaceId: ctx.workspaceId,
      type: 'callback',
      title: `معاودة اتصال — ${parsed.data.customerName ?? parsed.data.customerPhone ?? 'متصل'}`,
      description: parsed.data.reason,
      status: 'requested',
      requestedById: 'voice',
      dedupeKey: `voice-callback:${ctx.callId}`,
      metadata: {
        phone: parsed.data.customerPhone,
        name: parsed.data.customerName,
        // Additive: the plain fields above still carry the number, since
        // that is what Ops actually dials to call the customer back and no
        // request-detail view exists yet to read a decrypted field from.
        // These twins mean a raw database read alone — a leaked connection
        // string, a stray backup — doesn't also hand over the number.
        phoneEncrypted: parsed.data.customerPhone ? protectString(parsed.data.customerPhone) : null,
        nameEncrypted: parsed.data.customerName ? protectString(parsed.data.customerName) : null,
        callId: ctx.callId,
      },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [changeRequest.workspaceId, changeRequest.dedupeKey] })
    .returning({ id: changeRequest.id })

  await db.update(call).set({ outcome: 'callback' }).where(eq(call.id, ctx.callId))

  if (parsed.data.customerPhone) {
    await upsertCustomerFromContact({
      workspaceId: ctx.workspaceId,
      phone: parsed.data.customerPhone,
      name: parsed.data.customerName ?? null,
      when: now,
    }).catch(() => console.error('[voice] could not upsert CRM contact from callback'))
  }

  return { ok: true, data: { logged: true, ...(inserted ? { requestId: inserted.id } : {}) } }
}

/* ─── transfer_to_human ──────────────────────────────────────────────────── */

async function transferToHuman(ctx: ToolContext, args: { reason?: string }): Promise<ToolResult> {
  if (!ctx.transferTo) {
    return { ok: false, error: 'لا يوجد رقم تحويل مضبوط.', fallback: 'callback' }
  }

  if (!ctx.referCall) {
    return { ok: false, error: 'مسار التحويل غير متاح حاليًا.', fallback: 'callback' }
  }

  const transferred = await ctx.referCall(ctx.transferTo)
  if (!transferred) {
    return { ok: false, error: 'تعذّر تحويل المكالمة الآن.', fallback: 'callback' }
  }

  await db
    .update(call)
    .set({ status: 'transferred', outcome: 'transfer' })
    .where(eq(call.id, ctx.callId))

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
  options: ToolExecutionOptions = {},
): Promise<ToolResult> {
  const handler = HANDLERS[name as ToolName]
  const started = Date.now()
  const executionId = options.executionId ?? id('tex')

  if (options.executionId) {
    let claimed: { id: string }[]
    try {
      claimed = await db
        .insert(toolExecution)
        .values({
          id: executionId,
          callId: ctx.callId,
          toolName: name,
          request: { protected: true },
          requestEncrypted: protectJson(args),
          status: 'running',
          executedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: toolExecution.id })
    } catch {
      console.error(`[voice] could not claim tool execution ${name}`)
      return {
        ok: false,
        error: 'تعذّر تأمين تنفيذ الطلب. لم يتم تنفيذ الإجراء.',
        fallback: 'retry',
      }
    }

    if (claimed.length === 0) {
      const [existing] = await db
        .select({ result: toolExecution.result, resultEncrypted: toolExecution.resultEncrypted })
        .from(toolExecution)
        .where(eq(toolExecution.id, executionId))
        .limit(1)

      const existingResult = revealJson(existing?.resultEncrypted, existing?.result)
      if (isToolResult(existingResult)) return existingResult

      return {
        ok: false,
        error: 'الإجراء قيد التنفيذ بالفعل. لا تكرر الطلب الآن.',
        fallback: 'retry',
      }
    }
  }

  let result: ToolResult
  if (!handler) {
    result = { ok: false, error: 'أداة غير معروفة.', fallback: 'transfer' }
  } else
    try {
      result = await handler({ ...ctx, operationId: executionId }, args)
    } catch {
      console.error(`[voice] tool ${name} threw`)
      result = { ok: false, error: 'تعذّر تنفيذ الطلب.', fallback: 'callback' }
    }

  const latencyMs = Date.now() - started

  const persistedResult = result as unknown as Record<string, unknown>
  if (options.executionId) {
    await db
      .update(toolExecution)
      .set({
        result: { protected: true },
        resultEncrypted: protectJson(persistedResult),
        status: result.ok ? 'succeeded' : 'failed',
        latencyMs,
      })
      .where(eq(toolExecution.id, executionId))
      .catch(() => console.error('[voice] could not finish tool execution record'))
  } else {
    await db
      .insert(toolExecution)
      .values({
        id: executionId,
        callId: ctx.callId,
        toolName: name,
        request: { protected: true },
        requestEncrypted: protectJson(args),
        result: { protected: true },
        resultEncrypted: protectJson(persistedResult),
        status: result.ok ? 'succeeded' : 'failed',
        latencyMs,
        executedAt: new Date(),
      })
      .catch(() => console.error('[voice] could not record tool execution'))
  }

  return result
}

function isToolResult(value: unknown): value is ToolResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  return result.ok === true || result.ok === false
}
