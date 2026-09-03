import { describe, expect, it } from 'vitest'
import { memoryPressure, pressureFor, readVitals, startVitals } from '@/server/runtime/vitals'

describe('pressureFor', () => {
  // 2026-09-03: production's heap_size_limit measured ~195MB for a flag whose
  // own sizing commit computed ~384MB on a plain local Node process — the same
  // flag, two different ceilings. heapUsedPct crossed 88% on ordinary usage as
  // a result, and acquireCallSlot() refused a real call over it while rssPct
  // (measured against the container limit that actually enforces 512MB) sat
  // near 50%. RSS is the number that killed the process on 2026-09-01; heap's
  // ceiling is the one that has since been caught lying. Only RSS may refuse.
  it('does not reach critical on heap alone, however high', () => {
    expect(pressureFor(99, 30)).toBe('high')
    expect(pressureFor(100, 0)).toBe('high')
  })

  it('reaches critical on rss alone, regardless of heap', () => {
    expect(pressureFor(10, 90)).toBe('critical')
  })

  it('is ok only when both are comfortably low', () => {
    expect(pressureFor(40, 40)).toBe('ok')
  })

  it('either signal past the high-water mark is at least high', () => {
    expect(pressureFor(80, 10)).toBe('high')
    expect(pressureFor(10, 80)).toBe('high')
  })
})

describe('vitals', () => {
  it('reports memory against the ceiling V8 is actually running under', () => {
    // The distinction the 2026-09-01 OOM turned on: `heapUsed` is what
    // --max-old-space-size bounds, `rss` is what the container's limit counts,
    // and they are not the same number. Both have to be visible.
    const vitals = readVitals()
    expect(vitals.rssMB).toBeGreaterThan(0)
    expect(vitals.heapUsedMB).toBeGreaterThan(0)
    expect(vitals.heapLimitMB).toBeGreaterThan(0)
    expect(vitals.rssMB).toBeGreaterThanOrEqual(vitals.heapUsedMB)
    expect(vitals.heapUsedPct).toBeGreaterThanOrEqual(0)
    expect(vitals.heapUsedPct).toBeLessThanOrEqual(100)
  })

  it('is healthy under normal conditions', () => {
    expect(readVitals().pressure).toBe('ok')
    expect(memoryPressure()).toBe('ok')
  })

  it('reports event-loop delay once sampling has started', () => {
    startVitals()
    const vitals = readVitals()
    expect(vitals.eventLoopP50Ms).toBeGreaterThanOrEqual(0)
    expect(vitals.eventLoopP99Ms).toBeGreaterThanOrEqual(vitals.eventLoopP50Ms)
  })

  it('is safe to start more than once', () => {
    startVitals()
    startVitals()
    expect(() => readVitals()).not.toThrow()
  })

  it('resets the window so each reading describes the interval since the last', () => {
    startVitals()
    readVitals({ reset: true })
    // After a reset the histogram is empty; reading it must still produce
    // numbers rather than NaN, or the log line becomes unparseable.
    const vitals = readVitals()
    expect(Number.isFinite(vitals.eventLoopP50Ms)).toBe(true)
    expect(Number.isFinite(vitals.eventLoopP99Ms)).toBe(true)
  })
})
