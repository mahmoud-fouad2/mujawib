import { describe, expect, it } from 'vitest'
import { limitAction } from '@/server/actions/guard'

/**
 * Each case uses its own user id so the in-memory windows cannot leak between
 * tests — which is also the property being asserted: the ceiling is per user,
 * not global, so one operator cannot exhaust another's allowance.
 */
function user(name: string) {
  return `${name}_${Math.random().toString(36).slice(2)}`
}

describe('costly action guard', () => {
  it('allows normal use and then stops runaway repetition', () => {
    const id = user('suite')
    // Six suite runs are a normal working session; the seventh in ten minutes
    // is a stuck retry or a leaning finger, and each one opens a Realtime
    // session per scenario.
    for (let i = 0; i < 6; i += 1) {
      expect(limitAction('test_suite', id)).toBeNull()
    }
    const blocked = limitAction('test_suite', id)
    expect(blocked).not.toBeNull()
    expect(blocked?.ok).toBe(false)
  })

  it('keeps one user’s limit away from another’s', () => {
    const a = user('a')
    const b = user('b')
    for (let i = 0; i < 6; i += 1) limitAction('test_suite', a)
    expect(limitAction('test_suite', a)).not.toBeNull()
    expect(limitAction('test_suite', b)).toBeNull()
  })

  it('counts each action separately', () => {
    const id = user('mixed')
    for (let i = 0; i < 6; i += 1) limitAction('test_suite', id)
    expect(limitAction('test_suite', id)).not.toBeNull()
    // Exhausting the suite budget must not also block a summary retry.
    expect(limitAction('call_summary', id)).toBeNull()
  })

  it('tells the caller when to come back', () => {
    const id = user('message')
    for (let i = 0; i < 6; i += 1) limitAction('test_suite', id)
    const blocked = limitAction('test_suite', id)
    expect(blocked?.error).toMatch(/دقائق|ثانية/)
  })
})
