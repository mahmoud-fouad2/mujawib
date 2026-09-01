import { monitorEventLoopDelay } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'

/**
 * Process vitals: memory, event-loop delay, and whether either is in trouble.
 *
 * On 2026-09-01 a Render instance was killed with "Ran out of memory (used over
 * 512MB) while running your code", roughly two hours after a deploy. Nothing in
 * the process could say what had grown, because nothing measured anything: the
 * audit listed memory, event-loop lag and heap headroom as unmeasured, and an
 * OOM kill leaves no trace inside the process that died.
 *
 * Two numbers matter and they are not the same one:
 *
 *   `heapUsed` is what V8 manages and what `--max-old-space-size` bounds.
 *   `rss` is what the container's memory limit actually counts — the heap plus
 *   native allocations, loaded code, stacks and buffers.
 *
 * The gap between them is why the old start command could not fit: measured
 * baseline `rss` for this app is ~216MB with no traffic at all, so a 384MB heap
 * ceiling permits an `rss` well past 512MB before V8 ever feels obliged to
 * collect. See the note on `start` in package.json.
 */

export type MemoryPressure = 'ok' | 'high' | 'critical'

export type Vitals = {
  rssMB: number
  heapUsedMB: number
  heapTotalMB: number
  heapLimitMB: number
  externalMB: number
  /** Heap used as a share of the ceiling V8 is actually running under. */
  heapUsedPct: number
  /** RSS as a share of the container's limit — the number that gets us killed. */
  rssPct: number
  containerLimitMB: number
  pressure: MemoryPressure
  eventLoopP50Ms: number
  eventLoopP99Ms: number
  uptimeSeconds: number
}

const DEFAULT_CONTAINER_LIMIT_MB = 512

/**
 * The container's memory limit, which Node cannot discover for itself.
 *
 * V8 sizes its heap from the *host's* memory, not the cgroup's, so without
 * being told it will happily plan for a machine far larger than the box it is
 * in. `--max-old-space-size` in package.json#start is the other half of this;
 * this value is what the pressure signal is measured against.
 */
function containerLimitMB(): number {
  const configured = Number(process.env.MEMORY_LIMIT_MB)
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_CONTAINER_LIMIT_MB
}

/**
 * Where a call starts being refused rather than accepted onto a process that
 * is close to being killed. A refused call rings through to the client's human
 * line; an OOM kill drops every call the process is carrying at once.
 */
const HIGH_WATER_PCT = 75
const CRITICAL_WATER_PCT = 88

let histogram: ReturnType<typeof monitorEventLoopDelay> | null = null

/**
 * Starts sampling event-loop delay. Called once at boot.
 *
 * The histogram is a native object sampled by libuv, not a JS timer, so it
 * costs effectively nothing and — unlike a `setInterval` that measures its own
 * lateness — it keeps measuring while the loop is blocked, which is the case
 * worth seeing.
 */
export function startVitals() {
  if (histogram) return
  histogram = monitorEventLoopDelay({ resolution: 20 })
  histogram.enable()
}

function pressureFor(heapUsedPct: number): MemoryPressure {
  if (heapUsedPct >= CRITICAL_WATER_PCT) return 'critical'
  if (heapUsedPct >= HIGH_WATER_PCT) return 'high'
  return 'ok'
}

const mb = (bytes: number) => Math.round(bytes / 1_048_576)

/**
 * Reads current vitals. Resetting the histogram makes each reading describe
 * the interval since the last one rather than all of history, which is what a
 * per-tick log line should say.
 */
export function readVitals(options: { reset?: boolean } = {}): Vitals {
  const memory = process.memoryUsage()
  const heapLimit = getHeapStatistics().heap_size_limit
  const limitMB = containerLimitMB()
  const rssMB = mb(memory.rss)
  const heapUsedPct = heapLimit > 0 ? Math.round((memory.heapUsed / heapLimit) * 100) : 0
  const rssPct = Math.round((rssMB / limitMB) * 100)

  const p50 = histogram ? histogram.percentile(50) / 1_000_000 : 0
  const p99 = histogram ? histogram.percentile(99) / 1_000_000 : 0
  if (options.reset) histogram?.reset()

  return {
    rssMB,
    heapUsedMB: mb(memory.heapUsed),
    heapTotalMB: mb(memory.heapTotal),
    heapLimitMB: mb(heapLimit),
    externalMB: mb(memory.external),
    heapUsedPct,
    rssPct,
    containerLimitMB: limitMB,
    // Whichever is worse. Heap alone under-reports: on 2026-09-01 the live set
    // was a fraction of the heap ceiling while RSS — which is what the
    // container counts — was the number that crossed 512MB.
    pressure: pressureFor(Math.max(heapUsedPct, rssPct)),
    eventLoopP50Ms: Math.round(p50 * 100) / 100,
    eventLoopP99Ms: Math.round(p99 * 100) / 100,
    uptimeSeconds: Math.round(process.uptime()),
  }
}

/**
 * The one comparison the call path can afford before answering a call.
 *
 * Builds no vitals object and touches no histogram: this runs on the inbound
 * webhook, where the whole point of the work above it was to remove
 * milliseconds, not add them.
 */
export function memoryPressure(): MemoryPressure {
  const memory = process.memoryUsage()
  const heapLimit = getHeapStatistics().heap_size_limit
  const heapPct = heapLimit > 0 ? Math.round((memory.heapUsed / heapLimit) * 100) : 0
  const rssPct = Math.round((mb(memory.rss) / containerLimitMB()) * 100)
  return pressureFor(Math.max(heapPct, rssPct))
}
