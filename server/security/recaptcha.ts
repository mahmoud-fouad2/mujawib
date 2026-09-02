import 'server-only'

import { env } from '@/lib/env'

/**
 * Google reCAPTCHA v3 verification, shared by every public form.
 *
 * It lived inside `server/actions/contact.ts` as a private helper. A second
 * public form needed it, and the one thing that must not happen is exporting
 * it from a `'use server'` module — every export there is a POST endpoint, so
 * "share the helper" would have shipped an unauthenticated token-verification
 * endpoint to the browser. A plain server module is the right home.
 *
 * Returns true when the check is not configured at all, following the same
 * "optional integration, off until its variables exist" rule as every other
 * integration in `lib/env.ts`: a missing key degrades to the honeypot, rate
 * limits and blocklist behind it, not to a form that rejects everybody.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  remoteIp: string,
  action: string,
): Promise<boolean> {
  const secret = env.RECAPTCHA_SECRET_KEY
  if (!secret) return true
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp })
  const result = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(5_000),
  })
    .then((response) => response.json())
    .catch(() => null)

  if (!result?.success) return false
  // A token minted for a different form is not evidence about this one.
  if (typeof result.action === 'string' && result.action !== action) return false
  // v3 returns a 0–1 risk score rather than a pass/fail challenge; 0.5 is
  // Google's own documented default threshold.
  return result.score === undefined || result.score >= 0.5
}
