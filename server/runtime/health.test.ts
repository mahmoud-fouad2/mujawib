import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { livenessReport } from '@/server/runtime/health'
import {
  __resetLifecycleForTests,
  beginDraining,
  registerDrainHook,
} from '@/server/runtime/lifecycle'
import { __resetAdmissionForTests, acquireCallSlot } from '@/server/voice/admission'

describe('liveness', () => {
  beforeEach(() => {
    __resetLifecycleForTests()
    __resetAdmissionForTests()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    __resetLifecycleForTests()
    __resetAdmissionForTests()
    vi.restoreAllMocks()
  })

  it('answers ok without touching the database', () => {
    // The regression this guards: /api/health returned 503 whenever a single
    // `select 1` failed, and the platform health check pointed at it — so a
    // transient database blip was read as "restart this container", which is
    // the one response that severs the control channel of every live call.
    // Liveness must be decidable from process state alone.
    expect(livenessReport().status).toBe('ok')
  })

  it('stays ok while draining, so a deploy is never cut short', async () => {
    // A drain with nothing in flight finishes synchronously, so the only way
    // to observe the draining phase is to hold something open — which is also
    // the case that matters: a container still carrying calls must keep
    // answering the platform's health check, or it gets restarted mid-drain.
    let live = 1
    registerDrainHook({
      name: 'test',
      active: () => live,
      handOff: async () => undefined,
    })

    const drained = beginDraining('SIGTERM')
    const report = livenessReport()
    expect(report.status).toBe('ok')
    expect(report.phase).toBe('draining')

    live = 0
    await drained
    expect(livenessReport().status).toBe('ok')
  })

  it('reports how full the process is', () => {
    acquireCallSlot()
    acquireCallSlot()
    const report = livenessReport()
    expect(report.activeCalls).toBe(2)
    expect(report.callLimit).toBeGreaterThan(0)
  })
})
