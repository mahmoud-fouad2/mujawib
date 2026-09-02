import 'server-only'

import { rateLimit } from '@/lib/rate-limit'

/**
 * A per-user ceiling on the Server Actions that spend money or hold the
 * process.
 *
 * `rateLimit` guarded exactly three entry points — the voice webhook, the
 * analytics beacon and the public contact form — while sixty-six Server
 * Actions had none. Most of those are cheap writes where authentication is
 * protection enough. A few are not: running a Test Lab suite opens a Realtime
 * session per scenario, regenerating a summary is a 25-second model call, and
 * testing an integration makes an outbound request to a third party. A
 * repeated click, a stuck retry loop, or one careless script turns any of
 * those into real spend or a blocked event loop.
 *
 * Keyed on the user rather than the IP: these are authenticated actions, and
 * the identity that matters for both cost and abuse is the account.
 */

export type ActionGuardFailure = { ok: false; error: string }

/** Windows are per user, per action name. */
const LIMITS = {
  /** Opens one Realtime session per scenario, up to twelve per batch. */
  test_suite: { limit: 6, windowMs: 10 * 60_000 },
  /** One Realtime session. */
  test_scenario: { limit: 30, windowMs: 10 * 60_000 },
  /** A 25-second model call. */
  call_summary: { limit: 20, windowMs: 10 * 60_000 },
  /** An outbound request to the client's own endpoint. */
  integration_test: { limit: 30, windowMs: 10 * 60_000 },
  /** Reaches a paid telephony provider. */
  phone_provisioning: { limit: 20, windowMs: 10 * 60_000 },
  /** Parses and inserts up to five thousand rows in one call. */
  campaign_import: { limit: 10, windowMs: 10 * 60_000 },
  /** Starts something that rings real phones. */
  campaign_control: { limit: 30, windowMs: 10 * 60_000 },
} as const

export type GuardedAction = keyof typeof LIMITS

/**
 * Returns a failure to hand straight back to the caller, or null to proceed.
 *
 * Shaped to match `requireActionPermission` so a guarded action reads as two
 * consecutive early returns rather than nested conditions.
 */
export function limitAction(action: GuardedAction, userId: string): ActionGuardFailure | null {
  const { limit, windowMs } = LIMITS[action]
  const result = rateLimit(`action:${action}:${userId}`, limit, windowMs)
  if (result.success) return null

  const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  const minutes = Math.ceil(seconds / 60)
  return {
    ok: false,
    error:
      minutes > 1
        ? `تجاوزت حد التشغيل لهذا الإجراء. أعد المحاولة بعد ${minutes} دقائق.`
        : `تجاوزت حد التشغيل لهذا الإجراء. أعد المحاولة بعد ${seconds} ثانية.`,
  }
}
