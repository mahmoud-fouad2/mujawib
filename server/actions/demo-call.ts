'use server'

import { createHash, randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import {
  DEMO_ADDRESS_WINDOW_MS,
  DEMO_PHONE_REFUSAL_LABEL,
  DEMO_THROTTLE_LABEL,
  demoThrottle,
  normalizeDemoPhone,
} from '@/lib/demo-call'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { limitAction } from '@/server/actions/guard'
import { authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import { agent, agentVersion, auditLog, demoCallRequest, phoneNumber } from '@/server/db/schema'
import { notifyOperators, tryNotify } from '@/server/notifications/service'
import { outboundDialerStatus, placeOutboundCall } from '@/server/outbound/dialer'
import { maskNumber } from '@/server/voice/log'

/**
 * The public demo call.
 *
 * A visitor gives a country, a number and consent, and the platform calls them
 * back so they can hear the assistant. That is the product's strongest sales
 * argument and its most abusable surface, because the number typed into a
 * public form is very often not the number of the person typing it.
 *
 * So this is deliberately two actions with a person between them.
 * `requestDemoCall` is public and stores a request. `placeDemoCall` is
 * operator-only and is the thing that dials. There is no path from the first
 * to the second that does not pass through somebody deciding.
 *
 * That is not a placeholder for automation. Until this product verifies that
 * the requester owns the number — a code sent to it, and read back — an
 * unattended public dialer is a harassment tool with a nice landing page.
 */

export type DemoResult = { ok: true; message: string } | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

const requestSchema = z.object({
  countryCode: z.string().trim().length(2),
  phone: z.string().trim().min(4).max(30),
  name: z.string().trim().max(120).optional(),
  businessName: z.string().trim().max(160).optional(),
  personaKey: z
    .string()
    .trim()
    .regex(/^[a-z]+-[a-z]{2,4}$/)
    .optional(),
  locale: z.enum(['ar', 'en']),
  consent: z.boolean().refine((value) => value, 'Consent is required'),
  /** Honeypot. A real browser leaves it empty. */
  website: z.string().max(0).optional(),
})

function say(locale: 'ar' | 'en', ar: string, en: string) {
  return locale === 'en' ? en : ar
}

export async function requestDemoCall(input: z.input<typeof requestSchema>): Promise<DemoResult> {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: say(locale, 'تحقق من البيانات قبل الإرسال.', 'Please check the fields.'),
    }
  }
  const data = parsed.data

  // A bot filling every field gets a neutral success and no row, same as the
  // contact form — telling it which check it failed is telling it what to fix.
  if (data.website) {
    return { ok: true, message: say(locale, 'وصل طلبك.', 'Request received.') }
  }

  const normalized = normalizeDemoPhone(data.countryCode, data.phone)
  if (!normalized.ok) {
    return {
      ok: false,
      error: say(
        locale,
        DEMO_PHONE_REFUSAL_LABEL[normalized.reason],
        'That number does not look right for the country you picked.',
      ),
    }
  }

  const requestHeaders = await headers()
  const address = clientIdentifier(requestHeaders)

  // Cheap in-memory gate first, so a flood never reaches the database at all.
  const burst = rateLimit(`demo-call:${address}`, 6, DEMO_ADDRESS_WINDOW_MS)
  if (!burst.success) {
    return {
      ok: false,
      error: say(locale, DEMO_THROTTLE_LABEL.address_limit, 'Too many requests. Try in an hour.'),
    }
  }

  const now = new Date()
  const since = new Date(now.getTime() - DEMO_ADDRESS_WINDOW_MS)
  const fingerprint = createHash('sha256').update(`${address}:${normalized.phone}`).digest('hex')

  const [fromAddress, lastForNumber] = await Promise.all([
    db
      .select({ total: count() })
      .from(demoCallRequest)
      .where(
        and(
          eq(demoCallRequest.requestFingerprint, fingerprint),
          gte(demoCallRequest.createdAt, since),
        ),
      ),
    db
      .select({ createdAt: demoCallRequest.createdAt })
      .from(demoCallRequest)
      .where(eq(demoCallRequest.phone, normalized.phone))
      .orderBy(desc(demoCallRequest.createdAt))
      .limit(1),
  ])

  const throttle = demoThrottle({
    now,
    recentFromAddress: Number(fromAddress[0]?.total ?? 0),
    lastForNumberAt: lastForNumber[0]?.createdAt ?? null,
  })
  if (!throttle.ok) {
    return {
      ok: false,
      error: say(
        locale,
        DEMO_THROTTLE_LABEL[throttle.reason],
        throttle.reason === 'number_cooldown'
          ? 'A demo call was already requested for this number today.'
          : 'Too many requests. Try in an hour.',
      ),
    }
  }

  const requestId = id('demo')
  await db.insert(demoCallRequest).values({
    id: requestId,
    phone: normalized.phone,
    countryCode: normalized.country.code,
    name: data.name ?? null,
    businessName: data.businessName ?? null,
    personaKey: data.personaKey ?? null,
    locale,
    status: 'new',
    consentAt: now,
    requestFingerprint: fingerprint,
    createdAt: now,
    updatedAt: now,
  })

  void tryNotify(() =>
    notifyOperators({
      workspaceId: null,
      roles: ['owner', 'ops'],
      severity: 'info',
      category: 'change_request',
      title: 'طلب مكالمة تجريبية',
      // Masked here as everywhere else: a notification is read in places a
      // call record is not.
      message: `${data.businessName ?? data.name ?? 'زائر'} — ${maskNumber(normalized.phone)} (${normalized.country.labelAr})`,
      href: '/console/inquiries',
      sourceType: 'demo_request',
      sourceId: requestId,
      dedupeKey: `demo:${requestId}`,
    }),
  )

  revalidatePath('/console/inquiries')
  return {
    ok: true,
    message: say(
      locale,
      'وصل طلبك. سنتصل بك من مُجاوِب خلال ساعات العمل.',
      'Request received. Mujawib will call you during business hours.',
    ),
  }
}

/* ─── operator side ──────────────────────────────────────────────────────── */

const placeSchema = z.object({
  requestId: z.string().trim().min(1),
  agentVersionId: z.string().trim().min(1),
  fromNumberId: z.string().trim().min(1),
})

/**
 * Places the demo call, by hand, from the console.
 *
 * Behind `campaign.approve` rather than `client.manage`: this dials a real
 * number, and the permission that governs dialling is the one that should
 * govern it here too.
 */
export async function placeDemoCall(input: z.input<typeof placeSchema>): Promise<DemoResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إجراء المكالمات التجريبية.' }
  const limited = limitAction('campaign_control', access.userId)
  if (limited) return limited

  const parsed = placeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات غير مكتملة.' }

  const dialer = outboundDialerStatus()
  if (!dialer.ready) {
    return {
      ok: false,
      error: `الاتصال الصادر غير مُهيّأ. الناقص: ${dialer.missing.join('، ')}`,
    }
  }

  const [request] = await db
    .select()
    .from(demoCallRequest)
    .where(eq(demoCallRequest.id, parsed.data.requestId))
    .limit(1)
  if (!request) return { ok: false, error: 'الطلب غير موجود.' }
  if (!['new', 'approved', 'failed'].includes(request.status)) {
    return { ok: false, error: 'لا يمكن الاتصال بهذا الطلب في حالته الحالية.' }
  }

  // The agent and the number have to exist and belong together; the operator
  // picks which workspace demonstrates, so this is checked rather than assumed.
  const [version] = await db
    .select({ workspaceId: agent.workspaceId })
    .from(agentVersion)
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(eq(agentVersion.id, parsed.data.agentVersionId))
    .limit(1)
  if (!version) return { ok: false, error: 'النسخة غير موجودة.' }

  const [number] = await db
    .select({ e164: phoneNumber.e164 })
    .from(phoneNumber)
    .where(
      and(
        eq(phoneNumber.id, parsed.data.fromNumberId),
        eq(phoneNumber.workspaceId, version.workspaceId),
      ),
    )
    .limit(1)
  if (!number) return { ok: false, error: 'الرقم غير مربوط بنفس نشاط الموظف الصوتي.' }

  await db
    .update(demoCallRequest)
    .set({
      status: 'calling',
      attempts: request.attempts + 1,
      handledById: access.userId,
      updatedAt: new Date(),
    })
    .where(eq(demoCallRequest.id, request.id))

  const result = await placeOutboundCall({
    to: request.phone,
    from: number.e164,
    reference: `${request.id}-${request.attempts + 1}`,
  })

  await db
    .update(demoCallRequest)
    .set({
      status: result.ok ? 'completed' : 'failed',
      lastError: result.ok ? null : result.error.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(eq(demoCallRequest.id, request.id))

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: version.workspaceId,
    actorId: access.userId,
    action: result.ok ? 'demo.call_placed' : 'demo.call_failed',
    resourceType: 'demo_call_request',
    resourceId: request.id,
    metadata: { note: maskNumber(request.phone) },
    createdAt: new Date(),
  })

  revalidatePath('/console/inquiries')
  return result.ok
    ? { ok: true, message: 'بدأت المكالمة التجريبية.' }
    : { ok: false, error: result.error }
}

/** Closes a request without calling — spam, a wrong number, or a duplicate. */
export async function setDemoRequestStatus(
  requestId: string,
  status: 'rejected' | 'blocked' | 'approved',
  note: string,
): Promise<DemoResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الطلبات التجريبية.' }

  const [updated] = await db
    .update(demoCallRequest)
    .set({
      status,
      note: note.trim().slice(0, 400) || null,
      handledById: access.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(demoCallRequest.id, requestId),
        inArray(demoCallRequest.status, ['new', 'approved', 'failed']),
      ),
    )
    .returning({ phone: demoCallRequest.phone })
  if (!updated) return { ok: false, error: 'لا يمكن تغيير حالة هذا الطلب.' }

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: null,
    actorId: access.userId,
    action: `demo.${status}`,
    resourceType: 'demo_call_request',
    resourceId: requestId,
    metadata: { note: maskNumber(updated.phone) },
    createdAt: new Date(),
  })

  revalidatePath('/console/inquiries')
  return { ok: true, message: 'حُدِّثت حالة الطلب.' }
}
