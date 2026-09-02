import 'server-only'

import { sanitizeLogText } from '@/server/voice/log'

/**
 * One SMS, for one purpose: proving somebody owns the number they typed.
 *
 * Deliberately not a general messaging layer. This product does not send
 * marketing texts, reminders, or notifications by SMS, and a module that could
 * would be a module somebody eventually uses for that. It sends a verification
 * code and nothing else.
 *
 * Same shape as `dialer.ts`: a readiness probe that reads configuration only,
 * and a send that refuses unless the probe passes. With no credentials, this
 * deployment cannot text anybody, which is the default.
 */

export type SmsReadiness = {
  ready: boolean
  missing: string[]
}

export function smsStatus(): SmsReadiness {
  const missing: string[] = []
  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) missing.push('TWILIO_ACCOUNT_SID')
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) missing.push('TWILIO_AUTH_TOKEN')
  if (!process.env.TWILIO_SMS_FROM?.trim()) missing.push('TWILIO_SMS_FROM')
  return { ready: missing.length === 0, missing }
}

export type SendSmsResult = { ok: true; providerId: string } | { ok: false; error: string }

const E164 = /^\+[1-9]\d{7,14}$/

export async function sendVerificationSms(to: string, code: string): Promise<SendSmsResult> {
  const status = smsStatus()
  if (!status.ready) {
    return { ok: false, error: `SMS غير مُهيّأ (${status.missing.join('، ')})` }
  }
  if (!E164.test(to)) return { ok: false, error: 'رقم غير صالح' }
  if (!/^\d{4,8}$/.test(code)) return { ok: false, error: 'رمز غير صالح' }

  const sid = process.env.TWILIO_ACCOUNT_SID as string
  const token = process.env.TWILIO_AUTH_TOKEN as string
  const from = process.env.TWILIO_SMS_FROM as string

  // Bilingual and short. The recipient may not have asked for this — if the
  // number was typed by somebody else, this message is the only thing telling
  // them so, and it has to be readable in one glance on a lock screen.
  const body =
    `رمز مُجاوِب للتحقق: ${code}\n` +
    `صالح ١٠ دقائق. إن لم تطلبه، تجاهله ولن نتصل بك.\n` +
    `Mujawib code: ${code}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: controller.signal,
      },
    )
    const text = await response.text()
    if (!response.ok) return { ok: false, error: sanitizeLogText(`${response.status} ${text}`) }

    const parsed = JSON.parse(text) as { sid?: unknown }
    if (typeof parsed.sid !== 'string') return { ok: false, error: 'رد المزوّد بلا معرّف' }
    return { ok: true, providerId: parsed.sid }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      error: aborted
        ? 'انتهت مهلة إرسال الرمز'
        : sanitizeLogText(error instanceof Error ? error.message : 'provider error'),
    }
  } finally {
    clearTimeout(timeout)
  }
}
