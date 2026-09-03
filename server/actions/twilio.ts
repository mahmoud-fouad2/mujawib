'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { limitAction } from '@/server/actions/guard'
import { authorizeClientWorkspace, authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import { auditLog, changeRequest, phoneNumber } from '@/server/db/schema'

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

/**
 * Money never moves from a client's own click. `requestPhoneNumberPurchase`
 * only files a `changeRequest` — the same request/review/execute shape every
 * other client-portal ask in this product already goes through (Bible §21).
 * The actual Twilio purchase happens later, only from
 * `approvePhoneNumberPurchase`, which is operator-only.
 *
 * Earlier code let `rentPhoneNumber` call Twilio directly from a portal
 * click — real money, no operator in the loop, no price shown, and the
 * number it bought was never wired to the SIP path that actually answers
 * calls. This replaces that with the same managed-service pattern the rest
 * of the product uses: a client can ask, Ops decides.
 */
const requestSchema = z.object({
  workspaceId: z.string().min(1),
  e164Number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'رقم غير صالح.'),
  friendlyName: z.string().trim().max(120).optional(),
  locality: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().length(2),
})

export async function requestPhoneNumberPurchase(
  input: z.input<typeof requestSchema>,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات الطلب غير صحيحة.' }
  }
  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'phone.request')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية طلب رقم جديد.' }

  const [existingNumber] = await db
    .select({ id: phoneNumber.id })
    .from(phoneNumber)
    .where(eq(phoneNumber.e164, parsed.data.e164Number))
    .limit(1)
  if (existingNumber) return { ok: false, error: 'هذا الرقم مربوط بالفعل.' }

  const now = new Date()
  await db
    .insert(changeRequest)
    .values({
      id: id('cr'),
      workspaceId: parsed.data.workspaceId,
      type: 'phone_number_purchase',
      title: `طلب رقم جديد — ${parsed.data.e164Number}`,
      description: parsed.data.locality
        ? `${parsed.data.locality} (${parsed.data.countryCode})`
        : parsed.data.countryCode,
      status: 'requested',
      requestedById: access.userId,
      dedupeKey: `phone-purchase:${parsed.data.e164Number}`,
      metadata: {
        e164Number: parsed.data.e164Number,
        friendlyName: parsed.data.friendlyName ?? null,
        locality: parsed.data.locality ?? null,
        countryCode: parsed.data.countryCode,
      },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [changeRequest.workspaceId, changeRequest.dedupeKey] })

  revalidatePath('/portal/phone')
  return {
    ok: true,
    message: 'سُجّل طلبك. سيراجعه فريق التشغيل قبل تفعيل الرقم فعليًا.',
  }
}

/**
 * Country and area code, validated before either reaches a URL.
 *
 * `countryCode` is interpolated into the Twilio API *path*. Unvalidated, a
 * value containing `/` or `..` walks to a different endpoint on Twilio — using
 * the platform's own credentials. Two uppercase letters is the entire legal
 * shape of an ISO 3166-1 alpha-2 code, so the regex is not a guess at what is
 * dangerous; it is the complete set of what is valid.
 */
const searchSchema = z.object({
  workspaceId: z.string().trim().min(1),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'رمز الدولة غير صالح.'),
  areaCode: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, 'مفتاح المنطقة يجب أن يكون أرقامًا.')
    .optional(),
})

/**
 * Available numbers for a client to choose from.
 *
 * This had no authorization check at all. Every `'use server'` export is a
 * POST endpoint, and the action id ships in the client bundle of any page that
 * imports it — so this was effectively a public route that spent the
 * platform's Twilio credentials on each call, with `countryCode` going
 * straight into the request path. It now requires the same client-workspace
 * permission as the purchase request it feeds, validates both inputs, and is
 * rate limited per user because every invocation is a billable API call to a
 * third party.
 *
 * Read-only either way: money still only moves through
 * `approvePhoneNumberPurchase`, which is operator-only.
 */
export async function searchAvailableNumbers(
  input: z.input<typeof searchSchema>,
): Promise<
  | { ok: true; numbers: { friendlyName: string; phoneNumber: string; locality: string }[] }
  | { ok: false; error: string }
> {
  const parsed = searchSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? 'بيانات البحث غير صحيحة.',
    }
  }

  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'phone.request')
  if (!access) return { ok: false as const, error: 'ليس لديك صلاحية البحث عن رقم.' }

  const limited = limitAction('phone_provisioning', access.userId)
  if (limited) return { ok: false as const, error: limited.error }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    return { ok: false as const, error: 'ربط Twilio غير مضبوط على الخادم بعد.' }
  }

  const query = new URLSearchParams({ VoiceEnabled: 'true' })
  if (parsed.data.areaCode) query.set('AreaCode', parsed.data.areaCode)

  let response: Response
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${encodeURIComponent(parsed.data.countryCode)}/Local.json?${query}`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    return { ok: false as const, error: 'تعذّر الوصول إلى Twilio الآن.' }
  }
  if (!response.ok) return { ok: false as const, error: 'تعذّر البحث عن أرقام متاحة.' }

  const data = (await response.json().catch(() => null)) as {
    available_phone_numbers?: { friendly_name: string; phone_number: string; locality: string }[]
  } | null
  const numbers = (data?.available_phone_numbers ?? []).map((n) => ({
    friendlyName: n.friendly_name,
    phoneNumber: n.phone_number,
    locality: n.locality,
  }))
  return { ok: true as const, numbers }
}

/** Pending `phone_number_purchase` requests, for the operator's review queue. */
export async function getPendingPhoneRequests() {
  // Operator-gated. Without this, the exported action returned every client's
  // pending request — workspace id, chosen number, locality — to anyone able
  // to reach the endpoint, which for a `'use server'` export is anyone holding
  // the action id from a shipped bundle. An empty list rather than a throw
  // keeps the review queue rendering as an empty state for an operator whose
  // permission was revoked mid-session.
  const access = await authorizeOperator('phone.manage')
  if (!access) return []

  const rows = await db
    .select()
    .from(changeRequest)
    .where(eq(changeRequest.type, 'phone_number_purchase'))
  return rows
    .filter((row) => row.status === 'requested' || row.status === 'in_review')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * The only place a real Twilio purchase happens. Operator-only, and it does
 * not report success until Twilio's own API confirms the number is bought —
 * the same "no tool success without a real result" rule the voice runtime
 * follows (Bible §12) applies here too.
 *
 * A bought number still is not wired to MUJAWIB's call path: it lands in
 * `phoneNumber` with `sipStatus: 'pending'`, same as any manually linked
 * number, and needs the same SIP-trunk connection step Ops already does for
 * every other number before it can actually answer a call.
 */
export async function approvePhoneNumberPurchase(changeRequestId: string): Promise<ActionResult> {
  const access = await authorizeOperator('phone.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية اعتماد شراء الأرقام.' }

  const [row] = await db
    .select()
    .from(changeRequest)
    .where(eq(changeRequest.id, changeRequestId))
    .limit(1)
  if (row?.type !== 'phone_number_purchase') {
    return { ok: false, error: 'الطلب غير موجود.' }
  }
  if (row.status !== 'requested' && row.status !== 'in_review') {
    return { ok: false, error: 'هذا الطلب لم يعد قابلاً للاعتماد.' }
  }

  const meta = (row.metadata ?? {}) as { e164Number?: string }
  const e164Number = meta.e164Number
  if (!e164Number) return { ok: false, error: 'الطلب لا يحمل رقمًا صالحًا.' }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return { ok: false, error: 'ربط Twilio غير مضبوط على الخادم.' }

  let response: Response
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || ''
    const voiceUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/voice/fallback` : ''
    const searchParams = new URLSearchParams({ PhoneNumber: e164Number })
    if (voiceUrl?.startsWith('https://')) {
      searchParams.set('VoiceUrl', voiceUrl)
      searchParams.set('VoiceMethod', 'POST')
    }

    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: searchParams.toString(),
      },
    )
  } catch {
    return { ok: false, error: 'تعذّر الوصول إلى Twilio الآن. الطلب ما زال بانتظار المراجعة.' }
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}) as { message?: string })
    await db
      .update(changeRequest)
      .set({
        status: 'in_review',
        metadata: { ...(row.metadata ?? {}), lastError: detail.message ?? 'purchase_failed' },
        updatedAt: new Date(),
      })
      .where(eq(changeRequest.id, changeRequestId))
    return { ok: false, error: detail.message || 'فشل الشراء الفعلي من Twilio.' }
  }

  const now = new Date()
  const phoneId = id('phone')
  await db.insert(phoneNumber).values({
    id: phoneId,
    workspaceId: row.workspaceId,
    e164: e164Number,
    label: meta.e164Number ? `رقم مُستأجر — ${meta.e164Number}` : 'رقم مُستأجر',
    mode: 'all_calls',
    sipStatus: 'pending',
    routingRules: {},
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(changeRequest)
    .set({ status: 'live', assignedToId: access.userId, updatedAt: now })
    .where(eq(changeRequest.id, changeRequestId))

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: row.workspaceId,
    actorId: access.userId,
    action: 'phone.purchase_approved',
    resourceType: 'phone_number',
    resourceId: phoneId,
    metadata: { note: `شراء واعتماد ${e164Number} عبر Twilio`, changeRequestId },
    createdAt: now,
  })

  revalidatePath('/console/phone')
  revalidatePath('/portal/phone')
  return {
    ok: true,
    message: `اشتُري ${e164Number}. يبقى ربط مسار SIP قبل أن يستقبل مكالمات فعلية.`,
  }
}

export async function rejectPhoneNumberPurchase(
  changeRequestId: string,
  reason?: string,
): Promise<ActionResult> {
  const access = await authorizeOperator('phone.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية رفض الطلب.' }

  const [row] = await db
    .select({
      id: changeRequest.id,
      type: changeRequest.type,
      workspaceId: changeRequest.workspaceId,
    })
    .from(changeRequest)
    .where(eq(changeRequest.id, changeRequestId))
    .limit(1)
  if (row?.type !== 'phone_number_purchase') return { ok: false, error: 'الطلب غير موجود.' }

  const now = new Date()
  await db
    .update(changeRequest)
    .set({
      status: 'rejected',
      assignedToId: access.userId,
      description: reason?.trim() || undefined,
      updatedAt: now,
    })
    .where(eq(changeRequest.id, changeRequestId))

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: row.workspaceId,
    actorId: access.userId,
    action: 'phone.purchase_rejected',
    resourceType: 'change_request',
    resourceId: changeRequestId,
    metadata: { note: reason?.trim() || 'رفض طلب شراء رقم' },
    createdAt: now,
  })

  revalidatePath('/console/phone')
  return { ok: true, message: 'رُفض الطلب.' }
}
