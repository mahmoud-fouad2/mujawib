import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_CALL_DURATION_MINUTES,
  MAX_MAX_CALL_DURATION_MINUTES,
  MIN_MAX_CALL_DURATION_MINUTES,
  maxCallDurationMs,
} from '@/lib/call-limits'

describe('maxCallDurationMs', () => {
  it('defaults when unset', () => {
    expect(maxCallDurationMs(undefined)).toBe(DEFAULT_MAX_CALL_DURATION_MINUTES * 60_000)
  })

  it('honours a value inside the allowed range', () => {
    expect(maxCallDurationMs('15')).toBe(15 * 60_000)
  })

  it('treats zero as a configuration mistake, not "hang up instantly"', () => {
    // A real caller must never be cut off by a value nobody meant to set.
    expect(maxCallDurationMs('0')).toBe(DEFAULT_MAX_CALL_DURATION_MINUTES * 60_000)
  })

  it('treats a negative value the same way', () => {
    expect(maxCallDurationMs('-5')).toBe(DEFAULT_MAX_CALL_DURATION_MINUTES * 60_000)
  })

  it('treats garbage the same way', () => {
    expect(maxCallDurationMs('not-a-number')).toBe(DEFAULT_MAX_CALL_DURATION_MINUTES * 60_000)
  })

  it('clamps below the floor rather than trusting a very small value', () => {
    expect(maxCallDurationMs('1')).toBe(MIN_MAX_CALL_DURATION_MINUTES * 60_000)
  })

  it('clamps above the ceiling — a typo must not let one call run for days', () => {
    expect(maxCallDurationMs('2000')).toBe(MAX_MAX_CALL_DURATION_MINUTES * 60_000)
  })
})
