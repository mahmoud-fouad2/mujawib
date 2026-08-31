import 'server-only'

import { isDraining } from '@/server/runtime/lifecycle'

/**
 * How many calls this process will carry at once.
 *
 * `workspace.concurrentCallLimit` already existed and is enforced in the
 * inbound webhook, but it is a per-client contract limit, not a protection for
 * the process: twenty workspaces at the default of ten each add up to two
 * hundred permitted concurrent calls on one instance, and nothing anywhere
 * said "I am full". A system with no admission control does not degrade, it
 * accepts until it collapses — and when it collapses it takes every call with
 * it, not only the ones over the line.
 *
 * Refusing a call is a real outcome, not a failure: an unanswered SIP invite
 * falls back to the client's human line, which is a far better result for the
 * caller than being answered by a process that is already too loaded to hear
 * them.
 */

const DEFAULT_LIMIT = 25

export type AdmissionRefusal = {
  ok: false
  reason: 'draining' | 'at_capacity'
  active: number
  limit: number
}

export type CallSlot = {
  /** Idempotent — a slot released twice must not free someone else's. */
  release: () => void
}

export type AdmissionResult =
  | { ok: true; slot: CallSlot; active: number; limit: number }
  | AdmissionRefusal

let active = 0

export function realtimeCallLimit(): number {
  const configured = Number(process.env.ACTIVE_REALTIME_CALL_LIMIT)
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_LIMIT
}

export function activeRealtimeCalls(): number {
  return active
}

/**
 * Takes a slot, or explains why it could not.
 *
 * The slot is taken in the inbound webhook, before the call is accepted,
 * rather than when the control socket starts: accepting first and counting
 * afterwards leaves a window in which a burst is fully answered before the
 * first one is counted, which is precisely the case the limit exists for.
 */
export function acquireCallSlot(): AdmissionResult {
  const limit = realtimeCallLimit()

  if (isDraining()) {
    return { ok: false, reason: 'draining', active, limit }
  }
  if (active >= limit) {
    return { ok: false, reason: 'at_capacity', active, limit }
  }

  active += 1
  let released = false
  return {
    ok: true,
    active,
    limit,
    slot: {
      release() {
        if (released) return
        released = true
        active = Math.max(0, active - 1)
      },
    },
  }
}

/** Test-only reset. Nothing in the request path may call this. */
export function __resetAdmissionForTests() {
  active = 0
}
