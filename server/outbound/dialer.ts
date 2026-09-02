import 'server-only'

import { maskNumber, sanitizeLogText } from '@/server/voice/log'

/**
 * Placing an outbound call.
 *
 * This deployment has never placed one. Everything the product does today is
 * inbound: a caller dials a DID, the ingress provider passes the leg to
 * `sip:{project}@sip.api.openai.com`, OpenAI posts `realtime.call.incoming` to
 * `/api/voice/incoming`, and the sideband takes over. Outbound reverses only
 * the first hop — the provider originates the leg instead of receiving it, and
 * everything downstream of the SIP bridge is the code that already runs on
 * every real call.
 *
 * That first hop needs credentials this server does not have. So this module
 * has two jobs and they are deliberately separate:
 *
 * `outboundDialerStatus()` reports, from configuration alone, whether a call
 * could be placed. It is the honest answer to "is this feature on", and it is
 * what every campaign screen renders. Nothing about it guesses.
 *
 * `placeOutboundCall()` is the request itself. It refuses unless the status
 * says ready, so the default state of this deployment — unconfigured — cannot
 * dial anybody by accident.
 *
 * The distinction that matters: the status probe is proven (it reads env vars
 * this process can see). The dial is **not proven in production** — it has
 * never run against a live Twilio account from here. It is written to the
 * documented shape of both APIs and it is switched off until an operator
 * deliberately supplies credentials. The campaign UI says exactly this rather
 * than presenting a switched-off feature as a working one.
 */

export type DialerReadiness = {
  ready: boolean
  /** Which specific pieces are absent, for a UI that has to say what to set. */
  missing: string[]
  /** Never proven end-to-end from this deployment. Surfaced, not hidden. */
  verified: false
}

const SIP_HOST = 'sip.api.openai.com'

function projectSipTarget(): string | null {
  const explicit = process.env.OPENAI_SIP_URI?.trim()
  if (explicit) return explicit
  const project = process.env.OPENAI_PROJECT_ID?.trim()
  if (!project) return null
  return `sip:${project}@${SIP_HOST};transport=tls`
}

/**
 * Whether an outbound call could be placed right now, from configuration only.
 *
 * No network call, no database, no cache — a readiness probe that can itself
 * fail or hang is not a readiness probe. Callable from a Server Component.
 */
export function outboundDialerStatus(): DialerReadiness {
  const missing: string[] = []
  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) missing.push('TWILIO_ACCOUNT_SID')
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) missing.push('TWILIO_AUTH_TOKEN')
  if (!projectSipTarget()) missing.push('OPENAI_PROJECT_ID')
  return { ready: missing.length === 0, missing, verified: false }
}

export type PlaceCallInput = {
  /** E.164. Validated by the caller; re-checked here because this dials. */
  to: string
  /** E.164 of the DID the recipient will see. */
  from: string
  /** Correlates the provider leg with our campaign attempt row. */
  reference: string
}

export type PlaceCallResult =
  | { ok: true; providerCallId: string }
  | { ok: false; error: string; retryable: boolean }

const E164 = /^\+[1-9]\d{7,14}$/

/**
 * Originates one call and bridges it into the same SIP endpoint every inbound
 * call already lands on.
 *
 * Refuses before it does anything if the dialer is not configured. That
 * refusal is the safety property of this whole feature: with no credentials
 * set, no code path in this product can ring a phone.
 */
export async function placeOutboundCall(input: PlaceCallInput): Promise<PlaceCallResult> {
  const status = outboundDialerStatus()
  if (!status.ready) {
    return {
      ok: false,
      error: `الاتصال الصادر غير مُهيّأ (${status.missing.join('، ')})`,
      retryable: false,
    }
  }
  if (!E164.test(input.to) || !E164.test(input.from)) {
    return { ok: false, error: 'رقم غير صالح', retryable: false }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID as string
  const token = process.env.TWILIO_AUTH_TOKEN as string
  const target = projectSipTarget() as string

  // The recipient's leg is handed to the same SIP endpoint the inbound path
  // uses, so `realtime.call.incoming` fires and the existing sideband handles
  // the conversation. No second media path, no separate runtime.
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true">` +
    `<Sip>${escapeXml(target)}</Sip></Dial></Response>`

  const body = new URLSearchParams({
    To: input.to,
    From: input.from,
    Twiml: twiml,
    // Twilio gives up rather than leaving a phone ringing indefinitely.
    Timeout: '25',
    MachineDetection: 'Enable',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          // Twilio's own idempotency: a retried tick must not place a second
          // call to the same person for the same attempt.
          'I-Twilio-Idempotency-Token': input.reference,
        },
        body,
        signal: controller.signal,
      },
    )

    const text = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        error: sanitizeLogText(`${response.status} ${text}`),
        // 4xx is our request being wrong; retrying it just calls again.
        retryable: response.status >= 500 || response.status === 429,
      }
    }

    const parsed = JSON.parse(text) as { sid?: unknown }
    if (typeof parsed.sid !== 'string' || !parsed.sid) {
      return { ok: false, error: 'رد المزوّد بلا معرّف مكالمة', retryable: true }
    }
    return { ok: true, providerCallId: parsed.sid }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      error: aborted
        ? 'انتهت مهلة طلب الاتصال'
        : sanitizeLogText(error instanceof Error ? error.message : 'provider error'),
      retryable: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** Re-exported so callers logging a dial do not reach into the voice logger. */
export { maskNumber }
