import 'server-only'

import { isDraining } from '@/server/runtime/lifecycle'
import { voiceError, voiceLog } from '@/server/voice/log'

/**
 * Keeping a free-tier container from falling asleep.
 *
 * Render's free plan spins a service down after roughly fifteen minutes with
 * no inbound HTTP request. For most products that costs a slow first page
 * load. For this one it is fatal in a way nothing else in the codebase is: a
 * caller dials the number, the provider posts `realtime.call.incoming` to a
 * container that does not exist, and by the time one has booted the call is
 * already over. Nobody answers, and no row is written to say so — from inside
 * the product the call simply never happened.
 *
 * A request the process makes to its own public URL is inbound traffic from
 * the platform's point of view, so it resets that idle timer. That is all this
 * does.
 *
 * Three things worth being honest about:
 *
 * It is a workaround for a plan, not a fix for one. The actual fix is a paid
 * instance that is never spun down, and this exists to make the interim
 * survivable rather than to make the free plan adequate.
 *
 * It consumes the free plan's monthly instance-hours, because the container it
 * keeps awake is a container that is running. A service kept awake around the
 * clock will exhaust a 750-hour allowance before the month ends.
 *
 * It cannot help the very first call after a deploy or a crash, when there is
 * no process to ping. Nothing running inside the container can.
 *
 * Off unless `KEEP_AWAKE_URL` is set, so no other deployment pays for it and
 * nobody discovers it by surprise.
 */

/** Comfortably inside a fifteen-minute idle window, with room for one miss. */
const INTERVAL_MS = 10 * 60_000

type KeepAwakeGlobal = typeof globalThis & { __mujawibKeepAwake?: NodeJS.Timeout }

function target(): string | null {
  const configured = process.env.KEEP_AWAKE_URL?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    // Only the app's own health endpoint, and only over TLS. This runs
    // unattended on a timer, so it must not be turnable into a way to make
    // the server issue arbitrary requests by editing one environment
    // variable — a server-side request forgery with a scheduler attached.
    if (url.protocol !== 'https:') return null
    url.pathname = '/api/health/live'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function ping(url: string) {
  // A draining container is being replaced. Keeping it awake is the opposite
  // of what is wanted, and the request would land on its successor anyway.
  if (isDraining()) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': 'mujawib-keep-awake' },
      cache: 'no-store',
      signal: controller.signal,
    })
    // Logged at info and only on failure: a heartbeat that writes a line every
    // ten minutes is noise in the one log stream an incident is read from.
    if (!response.ok) voiceError('KEEP_AWAKE_FAILED', { status: response.status })
  } catch (error) {
    voiceError('KEEP_AWAKE_FAILED', {
      reason: error instanceof Error ? error.name : 'unknown',
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function startKeepAwake() {
  const url = target()
  if (!url) return

  const scope = globalThis as KeepAwakeGlobal
  if (scope.__mujawibKeepAwake) return

  voiceLog('KEEP_AWAKE_STARTED', { everyMinutes: INTERVAL_MS / 60_000 })
  scope.__mujawibKeepAwake = setInterval(() => void ping(url), INTERVAL_MS)
  // Never the reason the process stays alive during shutdown.
  scope.__mujawibKeepAwake.unref()
}
