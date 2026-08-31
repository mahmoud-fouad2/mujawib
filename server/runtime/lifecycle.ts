import 'server-only'

/**
 * Process lifecycle: draining, and what happens when Render replaces the
 * container while calls are on the line.
 *
 * Before this file the repository contained no signal handling at all
 * (`grep -rn "SIGTERM"` returned nothing). Every deploy killed every live
 * call's control channel instantly. The audio kept flowing — OpenAI holds the
 * media — so the caller carried on talking to an agent that could no longer
 * run a tool, write a transcript, or hang up, and the row sat `live` until the
 * four-hour reconciler in `server/jobs/worker.ts` closed it.
 *
 * Next.js installs its own SIGINT/SIGTERM handlers that call `process.exit(0)`
 * as soon as the HTTP server has closed. Those cannot be pre-empted from
 * another listener, because `process.exit` is immediate — which is exactly why
 * Next exposes `NEXT_MANUAL_SIG_HANDLE`. With that set, this module owns
 * termination, and owning it is what makes draining possible at all.
 *
 * What draining can and cannot promise, stated honestly: a real call lasts
 * minutes and a deploy grace window is tens of seconds, so "let every call
 * finish" is not achievable and is not what this does. It does three things
 * that are achievable, in order:
 *
 *   1. Stop answering new calls immediately, so no fresh caller is picked up
 *      by a process that is about to disappear.
 *   2. Give calls already in progress the whole grace window to end normally.
 *   3. Hand off whatever is still live, by releasing each sideband lease so
 *      the replacement process can reclaim it at once instead of waiting out
 *      the 120-second staleness window.
 */

import { voiceError, voiceLog } from '@/server/voice/log'

export type RuntimePhase = 'serving' | 'draining' | 'stopped'

/**
 * Something that owns work which must not be cut off mid-flight.
 *
 * Registration rather than a direct import, so this module does not depend on
 * the voice runtime — the dependency has to point that way, because the voice
 * runtime needs to ask this module whether it is draining.
 */
export type DrainHook = {
  name: string
  /** How much of this hook's work is still in flight. */
  active: () => number
  /**
   * Called once, after the grace window, for whatever is still active. Must
   * leave the work recoverable by another process rather than merely stopping
   * it, and must not throw.
   */
  handOff: () => Promise<void>
}

const DEFAULT_DRAIN_TIMEOUT_MS = 25_000
const DRAIN_POLL_MS = 250

let phase: RuntimePhase = 'serving'
const hooks: DrainHook[] = []

export function runtimePhase(): RuntimePhase {
  return phase
}

/**
 * The one question the call path asks. A draining process must refuse new
 * work while still serving the requests it already has — including answering
 * the inbound webhook, which has to reply in order to refuse politely.
 */
export function isDraining(): boolean {
  return phase !== 'serving'
}

export function registerDrainHook(hook: DrainHook) {
  hooks.push(hook)
}

function totalActive(): number {
  let total = 0
  for (const hook of hooks) {
    try {
      total += hook.active()
    } catch {
      // A hook that cannot count itself must not stall the shutdown.
    }
  }
  return total
}

function drainTimeoutMs(): number {
  const configured = Number(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS)
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_DRAIN_TIMEOUT_MS
}

let drainPromise: Promise<void> | null = null

/**
 * Enters draining and resolves once everything has either finished on its own
 * or been handed off. Safe to call more than once; the first call owns it.
 */
export function beginDraining(reason: string): Promise<void> {
  if (drainPromise) return drainPromise
  phase = 'draining'
  const startedAt = Date.now()
  const deadline = startedAt + drainTimeoutMs()
  const atStart = totalActive()

  voiceLog('SHUTDOWN_DRAINING', {
    reason,
    activeAtStart: atStart,
    timeoutMs: drainTimeoutMs(),
  })

  drainPromise = (async () => {
    while (Date.now() < deadline) {
      if (totalActive() === 0) break
      await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_MS))
    }

    const remaining = totalActive()
    if (remaining > 0) {
      voiceLog('SHUTDOWN_HANDOFF', { remaining, waitedMs: Date.now() - startedAt })
      for (const hook of hooks) {
        await hook.handOff().catch((error) =>
          voiceError('SHUTDOWN_HANDOFF_FAILED', {
            hook: hook.name,
            message: String(error).slice(0, 200),
          }),
        )
      }
    }

    phase = 'stopped'
    voiceLog('SHUTDOWN_COMPLETE', {
      reason,
      drainedMs: Date.now() - startedAt,
      activeAtStart: atStart,
      handedOff: remaining,
    })
  })()

  return drainPromise
}

let handlersInstalled = false

/**
 * Installs termination handling. A no-op unless `NEXT_MANUAL_SIG_HANDLE` is
 * set, because without it Next's own handler exits the process first and a
 * half-installed drain would be worse than none: it would log that draining
 * started and then be killed mid-sentence, which reads in the logs like the
 * drain itself hung.
 */
export function installShutdownHandlers() {
  if (handlersInstalled) return
  handlersInstalled = true

  if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
    voiceLog('SHUTDOWN_HANDLER_SKIPPED', {
      reason: 'NEXT_MANUAL_SIG_HANDLE is not set — Next.js owns termination',
    })
    return
  }

  let forced = false
  const onSignal = (signal: string) => () => {
    if (forced) {
      // A second signal means the platform is done waiting. Honour it.
      voiceError('SHUTDOWN_FORCED', { signal })
      process.exit(0)
    }
    forced = true
    void beginDraining(signal).finally(() => process.exit(0))
  }

  process.on('SIGTERM', onSignal('SIGTERM'))
  process.on('SIGINT', onSignal('SIGINT'))

  // Node's default for both of these is to crash, and that stays true here —
  // the only thing added is a line saying why, which the previous behaviour
  // (silent exit, nothing in the log stream) never produced.
  process.on('uncaughtException', (error) => {
    voiceError('UNCAUGHT_EXCEPTION', { message: String(error?.message ?? error).slice(0, 300) })
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    voiceError('UNHANDLED_REJECTION', { message: String(reason).slice(0, 300) })
    process.exit(1)
  })

  voiceLog('SHUTDOWN_HANDLER_INSTALLED', { drainTimeoutMs: drainTimeoutMs() })
}

/** Test-only reset. Nothing in the request path may call this. */
export function __resetLifecycleForTests() {
  phase = 'serving'
  drainPromise = null
  hooks.length = 0
}
