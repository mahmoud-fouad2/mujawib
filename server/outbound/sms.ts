import 'server-only'

import { sanitizeLogText } from '@/server/voice/log'

/**
 * Number-ownership verification, for one purpose: proving somebody owns the
 * number they typed into the public demo-call form.
 *
 * Twilio Verify owns the code end to end — generation, delivery, expiry, and
 * comparison. This module only starts a verification and checks one; it never
 * sees or stores the code itself. That used to be this codebase's own job (a
 * locally generated code, hashed, compared by hand against a raw SMS send),
 * which meant a leaked table or a timing bug here was a real exposure. Moving
 * that surface to a provider built for exactly this narrows it to "is the
 * Verify Service SID and its credentials configured" — nothing this file does
 * can itself leak or mis-time a code, because it never holds one.
 *
 * Deliberately not a general messaging layer. This product does not send
 * marketing texts, reminders, or notifications by SMS, and a module that could
 * would be a module somebody eventually uses for that.
 */

const E164 = /^\+[1-9]\d{7,14}$/
const VERIFY_SERVICE_SID = /^VA[0-9a-f]{32}$/i

export type SmsReadiness = {
  ready: boolean
  missing: string[]
  /** Set but not the right shape. See `dialer.ts` for why this is separate. */
  malformed: { key: string; expected: string }[]
}

export function smsStatus(): SmsReadiness {
  const missing: string[] = []
  const malformed: { key: string; expected: string }[] = []

  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) missing.push('TWILIO_ACCOUNT_SID')
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) missing.push('TWILIO_AUTH_TOKEN')

  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim()
  if (!serviceSid) missing.push('TWILIO_VERIFY_SERVICE_SID')
  else if (!VERIFY_SERVICE_SID.test(serviceSid)) {
    malformed.push({
      key: 'TWILIO_VERIFY_SERVICE_SID',
      expected: 'VA + 32 hex characters (a Twilio Verify Service SID)',
    })
  }

  return { ready: missing.length === 0 && malformed.length === 0, missing, malformed }
}

function verifyAuthHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID as string
  const token = process.env.TWILIO_AUTH_TOKEN as string
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

function verifyUrl(path: 'Verifications' | 'VerificationCheck'): string {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID as string
  return `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${path}`
}

async function postToVerify(
  path: 'Verifications' | 'VerificationCheck',
  body: Record<string, string>,
): Promise<{ ok: true; status: string } | { ok: false; notFound: boolean; error: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(verifyUrl(path), {
      method: 'POST',
      headers: {
        Authorization: verifyAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
      signal: controller.signal,
    })
    const text = await response.text()

    // No pending verification for this number: expired, already consumed, or
    // Twilio's own attempt ceiling was reached first. All three mean the same
    // thing to the caller — this code is no longer good, ask for a new one.
    if (response.status === 404) return { ok: false, notFound: true, error: 'not_found' }
    if (!response.ok)
      return { ok: false, notFound: false, error: sanitizeLogText(`${response.status} ${text}`) }

    const parsed = JSON.parse(text) as { status?: unknown }
    if (typeof parsed.status !== 'string') {
      return { ok: false, notFound: false, error: 'رد المزوّد بلا حالة' }
    }
    return { ok: true, status: parsed.status }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      notFound: false,
      error: aborted
        ? 'انتهت مهلة الاتصال بمزوّد التحقق'
        : sanitizeLogText(error instanceof Error ? error.message : 'provider error'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export type SendSmsResult = { ok: true; status: string } | { ok: false; error: string }

/** Starts a Verify Service check — Twilio generates the code and sends it. */
export async function sendVerificationSms(to: string): Promise<SendSmsResult> {
  const status = smsStatus()
  if (!status.ready) {
    const problems = [...status.missing, ...status.malformed.map((m) => `${m.key} (${m.expected})`)]
    return { ok: false, error: `التحقق غير مُهيّأ (${problems.join('، ')})` }
  }
  if (!E164.test(to)) return { ok: false, error: 'رقم غير صالح' }

  const result = await postToVerify('Verifications', { To: to, Channel: 'sms' })
  if (!result.ok) {
    return {
      ok: false,
      error: result.notFound ? 'تعذّر بدء التحقق' : result.error,
    }
  }
  return { ok: true, status: result.status }
}

export type CheckSmsResult = { ok: true; approved: boolean } | { ok: false; error: string }

/**
 * Checks a code against the Service's pending verification for this number.
 *
 * `approved: false` covers a wrong code — Twilio returns `status: "pending"`
 * for that, not an error, so a retry within the caller's own attempt ceiling
 * still works. A 404 (nothing pending: expired, already used, or Twilio's own
 * attempt ceiling already reached) also comes back as `approved: false` — the
 * caller cannot tell the two apart from this alone, which is correct: neither
 * one should read as "provider failure," and both are covered by the caller's
 * own expiry and attempt bookkeeping already refusing before this is reached.
 */
export async function checkVerificationSms(to: string, code: string): Promise<CheckSmsResult> {
  const status = smsStatus()
  if (!status.ready) {
    const problems = [...status.missing, ...status.malformed.map((m) => `${m.key} (${m.expected})`)]
    return { ok: false, error: `التحقق غير مُهيّأ (${problems.join('، ')})` }
  }
  if (!E164.test(to)) return { ok: false, error: 'رقم غير صالح' }
  if (!/^\d{3,10}$/.test(code)) return { ok: false, error: 'رمز غير صالح' }

  const result = await postToVerify('VerificationCheck', { To: to, Code: code })
  if (!result.ok) {
    if (result.notFound) return { ok: true, approved: false }
    return { ok: false, error: result.error }
  }
  return { ok: true, approved: result.status === 'approved' }
}
