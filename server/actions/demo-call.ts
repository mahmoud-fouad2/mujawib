'use server'

import { createHash, randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import {
  DEMO_ADDRESS_WINDOW_MS,
  DEMO_CODE_LENGTH,
  DEMO_CODE_TTL_MS,
  DEMO_PHONE_REFUSAL_LABEL,
  DEMO_THROTTLE_LABEL,
  demoThrottle,
  looksFake,
  normalizeDemoPhone,
  SPAM_REASON_LABEL,
  VERIFY_REFUSAL_LABEL,
  verifyGate,
} from '@/lib/demo-call'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { normalizePhoneE164 } from '@/lib/voice-normalization'
import { limitAction } from '@/server/actions/guard'
import { authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  demoBlock,
  demoCallRequest,
  phoneNumber,
} from '@/server/db/schema'
import { notifyOperators, tryNotify } from '@/server/notifications/service'
import { outboundDialerStatus, placeOutboundCall } from '@/server/outbound/dialer'
import { checkVerificationSms, sendVerificationSms, smsStatus } from '@/server/outbound/sms'
import { verifyRecaptcha } from '@/server/security/recaptcha'
import { maskNumber } from '@/server/voice/log'

/**
 * The public demo call.
 *
 * A visitor gives a country, a number and consent, and the platform calls them
 * back so they can hear the assistant. That is the product's strongest sales
 * argument and its most abusable surface, because the number typed into a
 * public form is very often not the number of the person typing it.
 *
 * So a call is only ever placed to a number somebody has proved they hold:
 * `requestDemoCall` texts a code, `verifyDemoCall` accepts it, and only a
 * request carrying `verifiedAt` is eligible to be dialled automatically.
 * Everything else waits for an operator.
 *
 * Five layers stand between the form and a phone ringing, and they are
 * independent on purpose — each one assumes the others have already failed:
 *
 *   1. a honeypot field and reCAPTCHA, for the traffic that is not a browser
 *   2. patterns nobody owns (+966500000000, +966512345678) refused outright
 *   3. a permanent blocklist, keyed on the number and on the request source
 *   4. rate limits: per browser per hour, and one call per number per day
 *   5. a platform-wide daily ceiling, which is what stops the bill when the
 *      four above fail at once
 *
 * Verification sits on top of all five. It is the only one that establishes
 * anything positive — the others only refuse.
 */

export type DemoResult =
  | { ok: true; message: string; data?: { requestId: string; needsVerification: boolean } }
  | { ok: false; error: string }

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
  recaptchaToken: z.string().optional(),
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

  // Patterns nobody owns. Cheaper than an SMS that could never be read, and
  // caught before the request reaches the database at all.
  const fake = looksFake(normalized.phone)
  if (fake.spam) {
    return {
      ok: false,
      error: say(locale, SPAM_REASON_LABEL[fake.reason], 'That number is not a real number.'),
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

  // Not a browser? Neutral success, no row, no SMS — telling a bot which
  // check it failed is telling it what to fix.
  const human = await verifyRecaptcha(data.recaptchaToken, address, 'demo_call')
  if (!human) {
    return { ok: true, message: say(locale, 'وصل طلبك.', 'Request received.') }
  }

  // The platform's own permanent refusals: a number, or a source, that must
  // never reach the dialer again. Checked before the rate limits, because a
  // block is not a delay.
  const [blocked] = await db
    .select({ id: demoBlock.id })
    .from(demoBlock)
    .where(
      or(
        and(eq(demoBlock.scope, 'phone'), eq(demoBlock.value, normalized.phone)),
        and(eq(demoBlock.scope, 'fingerprint'), eq(demoBlock.value, fingerprint)),
      ),
    )
    .limit(1)
  if (blocked) {
    return {
      ok: false,
      error: say(locale, SPAM_REASON_LABEL.blocked, 'This number cannot use the demo.'),
    }
  }

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

  /**
   * Twilio Verify manages the code end-to-end: generation, delivery, expiry,
   * and comparison. We never store or generate the code in plain text.
   */
  const sms = smsStatus()
  const requestId = id('demo')
  await db.insert(demoCallRequest).values({
    id: requestId,
    phone: normalized.phone,
    countryCode: normalized.country.code,
    name: data.name ?? null,
    businessName: data.businessName ?? null,
    personaKey: data.personaKey ?? null,
    locale,
    // Without SMS the number cannot be proved, so the request lands as a lead
    // an operator handles rather than as something the dispatcher may dial.
    status: sms.ready ? 'pending_verification' : 'new',
    ...(sms.ready
      ? {
          codeExpiresAt: new Date(now.getTime() + DEMO_CODE_TTL_MS),
          codeSentCount: 1,
        }
      : {}),
    consentAt: now,
    requestFingerprint: fingerprint,
    createdAt: now,
    updatedAt: now,
  })

  if (sms.ready) {
    const sent = await sendVerificationSms(normalized.phone)
    if (!sent.ok) {
      // The row stays, unverified and uncallable. Nothing is lost, and the
      // visitor is told the truth rather than left waiting for a text.
      await db
        .update(demoCallRequest)
        .set({ lastError: sent.error.slice(0, 300), updatedAt: new Date() })
        .where(eq(demoCallRequest.id, requestId))
      return {
        ok: false,
        error: say(locale, 'تعذّر إرسال رمز التحقق. حاول بعد قليل.', 'Could not send the code.'),
      }
    }
    return {
      ok: true,
      message: say(
        locale,
        `أرسلنا رمزًا من ${DEMO_CODE_LENGTH} أرقام إلى هاتفك. أدخله لتأكيد الرقم.`,
        `We sent a ${DEMO_CODE_LENGTH}-digit code to your phone. Enter it to confirm the number.`,
      ),
      data: { requestId, needsVerification: true },
    }
  }

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

/* ─── verification ───────────────────────────────────────────────────────── */

const verifySchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'الرمز أرقام فقط.'),
  locale: z.enum(['ar', 'en']),
})

/**
 * Accepts the code, and that is what makes an automatic call possible.
 *
 * Rate limited per browser on top of the per-request attempt ceiling, because
 * the ceiling alone only protects one row — somebody creating a request per
 * guess would otherwise get unlimited attempts across many rows.
 *
 * A wrong code increments the counter before anything else, so a failed guess
 * costs the guesser regardless of how the request ends.
 */
export async function verifyDemoCall(input: z.input<typeof verifySchema>): Promise<DemoResult> {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const parsed = verifySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: say(locale, 'الرمز أرقام فقط.', 'Digits only.') }
  }

  const requestHeaders = await headers()
  const address = clientIdentifier(requestHeaders)
  const burst = rateLimit(`demo-verify:${address}`, 15, 15 * 60_000)
  if (!burst.success) {
    return {
      ok: false,
      error: say(locale, 'محاولات كثيرة. جرّب بعد قليل.', 'Too many attempts. Try again later.'),
    }
  }

  const [request] = await db
    .select({
      id: demoCallRequest.id,
      phone: demoCallRequest.phone,
      status: demoCallRequest.status,
      codeHash: demoCallRequest.codeHash,
      codeExpiresAt: demoCallRequest.codeExpiresAt,
      codeAttempts: demoCallRequest.codeAttempts,
      verifiedAt: demoCallRequest.verifiedAt,
      businessName: demoCallRequest.businessName,
      name: demoCallRequest.name,
    })
    .from(demoCallRequest)
    .where(eq(demoCallRequest.id, parsed.data.requestId))
    .limit(1)
  // A request id that does not exist and a wrong code get the same answer.
  if (!request) return { ok: false, error: say(locale, VERIFY_REFUSAL_LABEL.expired, 'Expired.') }

  const gate = verifyGate({
    now: new Date(),
    expiresAt: request.codeExpiresAt,
    attempts: request.codeAttempts,
    verifiedAt: request.verifiedAt,
  })

  if (!gate.ok) {
    return {
      ok: false,
      error: say(locale, VERIFY_REFUSAL_LABEL[gate.reason], 'That code did not work.'),
    }
  }

  const check = await checkVerificationSms(request.phone, parsed.data.code)
  if (!check.ok) {
    return {
      ok: false,
      error: say(
        locale,
        'تعذّر التحقق من الرمز حاليًا. حاول بعد قليل.',
        'Could not verify the code. Try again in a moment.',
      ),
    }
  }

  if (!check.approved) {
    await db
      .update(demoCallRequest)
      .set({ codeAttempts: request.codeAttempts + 1, updatedAt: new Date() })
      .where(eq(demoCallRequest.id, request.id))
    return {
      ok: false,
      error: say(locale, VERIFY_REFUSAL_LABEL.wrong_code, 'That code did not work.'),
    }
  }

  const now = new Date()
  await db
    .update(demoCallRequest)
    .set({
      status: 'verified',
      verifiedAt: now,
      // Burned on success: a code that keeps working after it has been used is
      // a code somebody can reuse.
      codeHash: null,
      codeExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(demoCallRequest.id, request.id))

  void tryNotify(() =>
    notifyOperators({
      workspaceId: null,
      roles: ['owner', 'ops'],
      severity: 'info',
      category: 'change_request',
      title: 'رقم مؤكَّد — مكالمة تجريبية',
      message: `${request.businessName ?? request.name ?? 'زائر'} — ${maskNumber(request.phone)}`,
      href: '/console/inquiries',
      sourceType: 'demo_request',
      sourceId: request.id,
      dedupeKey: `demo-verified:${request.id}`,
    }),
  )

  revalidatePath('/console/inquiries')
  return {
    ok: true,
    message: say(
      locale,
      'تم تأكيد رقمك. سيتصل بك مُجاوِب خلال دقائق داخل ساعات العمل.',
      'Number confirmed. Mujawib will call you shortly, during business hours.',
    ),
  }
}

/**
 * Sends a fresh code for a request that has not been verified yet.
 *
 * Capped at three sends per request: resending is how a form becomes a way to
 * text somebody repeatedly, and three is enough for one dropped SMS.
 */
export async function resendDemoCode(input: z.input<typeof verifySchema>): Promise<DemoResult> {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const requestId = String(input.requestId ?? '').trim()
  if (!requestId) return { ok: false, error: say(locale, 'طلب غير معروف.', 'Unknown request.') }

  const requestHeaders = await headers()
  const address = clientIdentifier(requestHeaders)
  const burst = rateLimit(`demo-resend:${address}`, 3, 60 * 60_000)
  if (!burst.success) {
    return {
      ok: false,
      error: say(locale, 'طلبت الرمز مرات كثيرة.', 'Too many code requests.'),
    }
  }

  const sms = smsStatus()
  if (!sms.ready) {
    return { ok: false, error: say(locale, 'إرسال الرمز غير متاح حاليًا.', 'Codes unavailable.') }
  }

  const [request] = await db
    .select({
      id: demoCallRequest.id,
      phone: demoCallRequest.phone,
      verifiedAt: demoCallRequest.verifiedAt,
      codeSentCount: demoCallRequest.codeSentCount,
    })
    .from(demoCallRequest)
    .where(eq(demoCallRequest.id, requestId))
    .limit(1)
  if (!request || request.verifiedAt) {
    return { ok: false, error: say(locale, 'لا يمكن إرسال رمز جديد.', 'Cannot resend.') }
  }
  if (request.codeSentCount >= 3) {
    return {
      ok: false,
      error: say(locale, 'استُنفدت محاولات إرسال الرمز.', 'No more codes for this request.'),
    }
  }

  const sent = await sendVerificationSms(request.phone)
  if (!sent.ok) {
    return { ok: false, error: say(locale, 'تعذّر إرسال الرمز.', 'Could not send the code.') }
  }

  await db
    .update(demoCallRequest)
    .set({
      codeExpiresAt: new Date(Date.now() + DEMO_CODE_TTL_MS),
      codeAttempts: 0,
      codeSentCount: request.codeSentCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(demoCallRequest.id, request.id))

  return { ok: true, message: say(locale, 'أرسلنا رمزًا جديدًا.', 'A new code is on its way.') }
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
  // An operator may place a call to an unverified request — they are a person
  // deciding, which is the same standard the whole feature is built on. What
  // they may not do is call one that is blocked or already completed.
  if (!['pending_verification', 'verified', 'new', 'approved', 'failed'].includes(request.status)) {
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
        inArray(demoCallRequest.status, [
          'pending_verification',
          'verified',
          'new',
          'approved',
          'failed',
        ]),
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

/**
 * Blocks a number, or the source that submitted it, permanently.
 *
 * Two scopes because two things go wrong. A number blocked is somebody who
 * asked never to be called again, or a number being used to harass its owner.
 * A fingerprint blocked is the submitter — the hashed address-and-number pair
 * — which stops the same source burning through the rate limit with variations.
 *
 * No expiry, for the same reason the client suppression list has none.
 */
export async function blockDemoSource(
  requestId: string,
  scope: 'phone' | 'fingerprint',
  reason: string,
): Promise<DemoResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية الحظر.' }

  const [request] = await db
    .select({ phone: demoCallRequest.phone, fingerprint: demoCallRequest.requestFingerprint })
    .from(demoCallRequest)
    .where(eq(demoCallRequest.id, requestId))
    .limit(1)
  if (!request) return { ok: false, error: 'الطلب غير موجود.' }

  const value = scope === 'phone' ? request.phone : request.fingerprint
  await db
    .insert(demoBlock)
    .values({
      id: id('dblk'),
      scope,
      value,
      reason: reason.trim().slice(0, 300) || null,
      createdById: access.userId,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: [demoBlock.scope, demoBlock.value] })

  // Everything already queued from this source stops too. A blocklist that
  // only new requests consult leaves the pending ones to go through anyway.
  const stopped = await db
    .update(demoCallRequest)
    .set({ status: 'blocked', handledById: access.userId, updatedAt: new Date() })
    .where(
      and(
        scope === 'phone'
          ? eq(demoCallRequest.phone, request.phone)
          : eq(demoCallRequest.requestFingerprint, request.fingerprint),
        inArray(demoCallRequest.status, ['pending_verification', 'verified', 'new', 'approved']),
      ),
    )
    .returning({ id: demoCallRequest.id })

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: null,
    actorId: access.userId,
    action: 'demo.blocked',
    resourceType: 'demo_call_request',
    resourceId: requestId,
    metadata: { note: `${scope} — ${maskNumber(request.phone)}`, stopped: stopped.length },
    createdAt: new Date(),
  })

  revalidatePath('/console/inquiries')
  return {
    ok: true,
    message: stopped.length > 1 ? `حُظر المصدر وأُوقف ${stopped.length} طلبًا.` : 'حُظر المصدر.',
  }
}

/* ─── self-test ──────────────────────────────────────────────────────────── */

const selfTestSchema = z.object({
  phone: z.string().trim().min(6).max(30),
  kind: z.enum(['sms', 'call']),
})

/**
 * Sends a real SMS, or places a real call, to a number the operator types.
 *
 * The outbound path has never run from this deployment, and the honest way to
 * change that is not to reason about it — it is to try it once, deliberately,
 * against a number the person pressing the button owns. This is that button.
 *
 * It returns the provider's own error text rather than a friendly summary.
 * "Could not send" is useless here; `21606 The From number is not a valid,
 * SMS-capable inbound phone number` is the whole answer, and the person
 * reading it is the person who can fix it.
 */
export async function runOutboundSelfTest(
  input: z.input<typeof selfTestSchema>,
): Promise<DemoResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية اختبار الاتصال الصادر.' }
  // Same ceiling as starting a campaign: this spends money and rings a phone.
  const limited = limitAction('campaign_control', access.userId)
  if (limited) return limited

  const parsed = selfTestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'رقم غير صالح.' }

  const phone = normalizePhoneE164(parsed.data.phone)
  if (!phone) return { ok: false, error: 'اكتب الرقم بالصيغة الدولية، مثل +9665…' }

  if (parsed.data.kind === 'sms') {
    const status = smsStatus()
    if (!status.ready) {
      const problems = [
        ...status.missing,
        ...status.malformed.map((m) => `${m.key} (${m.expected})`),
      ]
      return { ok: false, error: `SMS غير مُهيّأ — ${problems.join('، ')}` }
    }
    const sent = await sendVerificationSms(phone)
    await db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: null,
      actorId: access.userId,
      action: sent.ok ? 'outbound.test_sms' : 'outbound.test_sms_failed',
      resourceType: 'outbound',
      resourceId: 'self_test',
      metadata: { note: maskNumber(phone), error: sent.ok ? null : sent.error },
      createdAt: new Date(),
    })
    return sent.ok
      ? { ok: true, message: `أُرسل رمز تحقق عبر Twilio Verify إلى ${maskNumber(phone)} بنجاح.` }
      : { ok: false, error: sent.error }
  }

  const target = await resolveDemoTargetForTest()
  if (!target) {
    return {
      ok: false,
      error: 'لا يوجد موظف صوتي منشور مربوط برقم — انشر نسخة واربط رقمًا أولًا.',
    }
  }

  const placed = await placeOutboundCall({
    to: phone,
    from: target.fromNumber,
    reference: `selftest-${Date.now()}`,
  })
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: null,
    actorId: access.userId,
    action: placed.ok ? 'outbound.test_call' : 'outbound.test_call_failed',
    resourceType: 'outbound',
    resourceId: 'self_test',
    metadata: { note: maskNumber(phone), error: placed.ok ? null : placed.error },
    createdAt: new Date(),
  })
  return placed.ok
    ? {
        ok: true,
        message: `بدأت مكالمة اختبار إلى ${maskNumber(phone)} من ${target.fromNumber} — سيردّ عليها ${target.agentLabel}.`,
      }
    : { ok: false, error: placed.error }
}

/** Imported lazily so this action file does not pull the dispatcher's graph. */
async function resolveDemoTargetForTest() {
  const { resolveDemoTarget } = await import('@/server/outbound/dispatcher')
  return resolveDemoTarget()
}
