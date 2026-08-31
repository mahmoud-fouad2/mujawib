import { describe, expect, it } from 'vitest'
import { backoffDelayMs, DEAD_JOB_STATUS, MAX_JOB_ATTEMPTS, planRetry } from '@/lib/job-backoff'

describe('backoffDelayMs', () => {
  it('never returns zero, so a failed job cannot retry in the same instant', () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      expect(backoffDelayMs(attempt, () => 0)).toBeGreaterThan(0)
    }
  })

  it('grows with each attempt', () => {
    const fixed = () => 0.5
    const first = backoffDelayMs(1, fixed)
    const second = backoffDelayMs(2, fixed)
    const third = backoffDelayMs(3, fixed)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('caps, so a long-broken job does not drift to an absurd delay', () => {
    expect(backoffDelayMs(50, () => 1)).toBeLessThanOrEqual(15 * 60_000)
  })

  it('spreads a cohort rather than releasing it together', () => {
    // The whole point of jitter: two jobs that failed at the same moment must
    // not come back at the same moment, which is what turns a provider blip
    // into a thundering herd.
    const low = backoffDelayMs(3, () => 0)
    const high = backoffDelayMs(3, () => 1)
    expect(high).toBeGreaterThan(low)
  })
})

describe('planRetry', () => {
  const now = new Date('2026-09-01T10:00:00.000Z')

  it('schedules a failed job into the future instead of immediately', () => {
    // This is the regression under test: the drain query used to pick up
    // `failed` jobs with no delay at all, so a permanently broken summary was
    // re-attempted every fifteen seconds forever, each attempt a real
    // 25-second OpenAI request.
    const plan = planRetry(0, now, () => 0.5)
    expect(plan.status).toBe('failed')
    expect(plan.attempts).toBe(1)
    expect(plan.availableAt.getTime()).toBeGreaterThan(now.getTime())
  })

  it('counts attempts upward from whatever the row already recorded', () => {
    expect(planRetry(2, now, () => 0.5).attempts).toBe(3)
  })

  it('stops retrying at the cap and marks the job dead', () => {
    const plan = planRetry(MAX_JOB_ATTEMPTS - 1, now, () => 0.5)
    expect(plan.attempts).toBe(MAX_JOB_ATTEMPTS)
    expect(plan.status).toBe(DEAD_JOB_STATUS)
  })

  it('reaches the cap within a bounded number of failures', () => {
    let attempts = 0
    let status = 'failed'
    for (let i = 0; i < 20 && status !== DEAD_JOB_STATUS; i += 1) {
      const plan = planRetry(attempts, now, () => 0.5)
      attempts = plan.attempts
      status = plan.status
    }
    expect(status).toBe(DEAD_JOB_STATUS)
    expect(attempts).toBe(MAX_JOB_ATTEMPTS)
  })
})
