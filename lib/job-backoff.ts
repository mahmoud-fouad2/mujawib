/**
 * Retry scheduling for `background_job`.
 *
 * The columns this uses — `attempts` and `available_at` — already existed in
 * the schema. Nothing read or wrote them on the failure path, and the drain
 * query selected `status in ('pending','failed')` with no delay and no cap, so
 * a job that could never succeed was retried every fifteen seconds forever.
 * Each of those retries is a real OpenAI request with a twenty-five second
 * timeout, and only three jobs are drained per tick, so one permanently broken
 * summary both burned money indefinitely and blocked healthy jobs behind it.
 *
 * Jitter is not decoration. Without it, a batch of jobs that failed together —
 * which is the normal shape of a provider outage — retries together, so the
 * first thing the provider sees on coming back is the same thundering herd
 * that is still failing.
 */

/** After this many attempts a job stops retrying and waits for a human. */
export const MAX_JOB_ATTEMPTS = 5

const BASE_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000

/** Terminal state for a job that exhausted its attempts. */
export const DEAD_JOB_STATUS = 'dead'

export type RetryPlan = {
  status: 'failed' | typeof DEAD_JOB_STATUS
  attempts: number
  availableAt: Date
  delayMs: number
}

/**
 * Exponential with equal jitter: half the window is fixed so a retry never
 * fires immediately, and half is random so a cohort spreads out.
 *
 * `random` is injectable purely so the tests can assert the bounds without
 * being flaky.
 */
export function backoffDelayMs(attempts: number, random: () => number = Math.random): number {
  const step = Math.max(1, Math.floor(attempts))
  const uncapped = BASE_DELAY_MS * 2 ** (step - 1)
  const ceiling = Math.min(MAX_DELAY_MS, uncapped)
  const half = ceiling / 2
  return Math.round(half + random() * half)
}

/**
 * What to write when an attempt fails.
 *
 * `dead` is a real state an operator can see and act on, not a silent stop:
 * the whole point of capping retries is that somebody finds out.
 */
export function planRetry(
  previousAttempts: number,
  now: Date = new Date(),
  random: () => number = Math.random,
): RetryPlan {
  const attempts = Math.max(0, Math.floor(previousAttempts)) + 1

  if (attempts >= MAX_JOB_ATTEMPTS) {
    return { status: DEAD_JOB_STATUS, attempts, availableAt: now, delayMs: 0 }
  }

  const delayMs = backoffDelayMs(attempts, random)
  return {
    status: 'failed',
    attempts,
    availableAt: new Date(now.getTime() + delayMs),
    delayMs,
  }
}

/** Statuses a drain may pick up. `dead` is deliberately absent. */
export const RETRYABLE_JOB_STATUSES = ['pending', 'failed'] as const
