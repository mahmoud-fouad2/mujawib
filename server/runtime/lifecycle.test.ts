import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetLifecycleForTests,
  beginDraining,
  isDraining,
  registerDrainHook,
  runtimePhase,
} from '@/server/runtime/lifecycle'

describe('draining', () => {
  beforeEach(() => {
    __resetLifecycleForTests()
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = '600'
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = undefined
    __resetLifecycleForTests()
    vi.restoreAllMocks()
  })

  it('stops accepting work the instant a signal arrives', async () => {
    expect(isDraining()).toBe(false)
    const drained = beginDraining('SIGTERM')
    // Synchronously true — a call arriving in the same tick as the signal
    // must already be refused, not answered by a process that is leaving.
    expect(isDraining()).toBe(true)
    await drained
  })

  it('lets work finish on its own without handing it over', async () => {
    let active = 1
    const handOff = vi.fn(async () => undefined)
    registerDrainHook({ name: 'calls', active: () => active, handOff })

    const drained = beginDraining('SIGTERM')
    setTimeout(() => {
      active = 0
    }, 50)
    await drained

    expect(handOff).not.toHaveBeenCalled()
    expect(runtimePhase()).toBe('stopped')
  })

  it('hands over whatever is still live when the window runs out', async () => {
    // The honest limit of draining: a call lasts minutes and a deploy grace
    // window is seconds. What is achievable is releasing the lease so the
    // replacement process can reclaim the call at once, instead of waiting out
    // the staleness window while the caller talks to an agent that can no
    // longer act.
    const handOff = vi.fn(async () => undefined)
    registerDrainHook({ name: 'calls', active: () => 2, handOff })

    await beginDraining('SIGTERM')

    expect(handOff).toHaveBeenCalledTimes(1)
    expect(runtimePhase()).toBe('stopped')
  })

  it('runs the drain once even if the signal repeats', async () => {
    const handOff = vi.fn(async () => undefined)
    registerDrainHook({ name: 'calls', active: () => 1, handOff })

    const first = beginDraining('SIGTERM')
    const second = beginDraining('SIGINT')
    expect(second).toBe(first)
    await first
    expect(handOff).toHaveBeenCalledTimes(1)
  })

  it('completes even when a hand-off throws', async () => {
    registerDrainHook({
      name: 'broken',
      active: () => 1,
      handOff: async () => {
        throw new Error('nope')
      },
    })
    await beginDraining('SIGTERM')
    expect(runtimePhase()).toBe('stopped')
  })

  it('is not stalled by a hook that cannot count itself', async () => {
    registerDrainHook({
      name: 'counting-error',
      active: () => {
        throw new Error('boom')
      },
      handOff: async () => undefined,
    })
    await beginDraining('SIGTERM')
    expect(runtimePhase()).toBe('stopped')
  })
})
