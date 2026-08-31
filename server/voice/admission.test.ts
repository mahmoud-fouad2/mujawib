import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetLifecycleForTests, beginDraining, isDraining } from '@/server/runtime/lifecycle'
import {
  __resetAdmissionForTests,
  acquireCallSlot,
  activeRealtimeCalls,
  realtimeCallLimit,
} from '@/server/voice/admission'

describe('admission control', () => {
  beforeEach(() => {
    __resetAdmissionForTests()
    __resetLifecycleForTests()
    process.env.ACTIVE_REALTIME_CALL_LIMIT = '3'
    // Draining logs a line per transition; the assertions are about the
    // decisions, not the output.
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.ACTIVE_REALTIME_CALL_LIMIT = undefined
    __resetAdmissionForTests()
    __resetLifecycleForTests()
    vi.restoreAllMocks()
  })

  it('admits up to the configured limit', () => {
    expect(realtimeCallLimit()).toBe(3)
    for (let i = 1; i <= 3; i += 1) {
      const result = acquireCallSlot()
      expect(result.ok).toBe(true)
      expect(activeRealtimeCalls()).toBe(i)
    }
  })

  it('refuses the call past the limit instead of accepting it', () => {
    // Refusing is the point: an unanswered invite falls through to the
    // client's human line, which beats being answered by a process that is
    // already too loaded to respond.
    for (let i = 0; i < 3; i += 1) acquireCallSlot()
    const refused = acquireCallSlot()
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.reason).toBe('at_capacity')
    expect(refused.active).toBe(3)
    expect(refused.limit).toBe(3)
    expect(activeRealtimeCalls()).toBe(3)
  })

  it('frees capacity again when a call ends', () => {
    const first = acquireCallSlot()
    acquireCallSlot()
    acquireCallSlot()
    expect(acquireCallSlot().ok).toBe(false)

    if (!first.ok) throw new Error('expected a slot')
    first.slot.release()
    expect(activeRealtimeCalls()).toBe(2)
    expect(acquireCallSlot().ok).toBe(true)
  })

  it('ignores a double release, so one call cannot free another call’s slot', () => {
    const a = acquireCallSlot()
    acquireCallSlot()
    if (!a.ok) throw new Error('expected a slot')
    a.slot.release()
    a.slot.release()
    a.slot.release()
    expect(activeRealtimeCalls()).toBe(1)
  })

  it('refuses new calls once the process starts draining', async () => {
    expect(isDraining()).toBe(false)
    const drained = beginDraining('SIGTERM')
    expect(isDraining()).toBe(true)

    const refused = acquireCallSlot()
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.reason).toBe('draining')
    expect(activeRealtimeCalls()).toBe(0)
    await drained
  })

  it('falls back to a safe default when the limit is unset or nonsense', () => {
    process.env.ACTIVE_REALTIME_CALL_LIMIT = 'not-a-number'
    expect(realtimeCallLimit()).toBe(25)
    process.env.ACTIVE_REALTIME_CALL_LIMIT = '0'
    expect(realtimeCallLimit()).toBe(25)
  })
})
