import 'server-only'

import { sql } from 'drizzle-orm'
import { runtimePhase } from '@/server/runtime/lifecycle'
import { readVitals, type Vitals } from '@/server/runtime/vitals'
import { activeRealtimeCalls, realtimeCallLimit } from '@/server/voice/admission'

/**
 * Liveness and readiness, which are different questions and used to be one.
 *
 * `/api/health` returned 503 whenever a single `select 1` failed, and
 * `render.yaml` pointed its health check at it. Those are incompatible: a
 * transient Neon blip — which this codebase knows happens, since
 * `isDatabaseUnavailable` in `server/db/index.ts` exists specifically to
 * absorb them — would be read by the platform as "this container is broken",
 * and restarting the container is the one response guaranteed to make it
 * worse, because it kills the control channel of every call in progress.
 *
 * Liveness answers "is this process still running code?" — nothing else, and
 * in particular nothing that depends on a network hop. Readiness answers
 * "should traffic be sent here?", which does depend on dependencies, and is
 * the one an operator or a load balancer should read.
 */

export type LivenessReport = {
  status: 'ok'
  phase: ReturnType<typeof runtimePhase>
  activeCalls: number
  callLimit: number
  uptimeSeconds: number
  vitals: Vitals
}

export type ReadinessReport = {
  status: 'ok' | 'degraded'
  ready: boolean
  phase: ReturnType<typeof runtimePhase>
  revision: string | null
  checks: {
    database: 'ok' | 'down'
    voice: 'ok' | 'disabled'
    protectedData: 'ok' | 'disabled'
    recordings: 'ok' | 'disabled' | 'misconfigured'
    lifecycle: 'ok' | 'draining'
  }
  activeCalls: number
  callLimit: number
  timestamp: string
}

export function deploymentRevision(): string | null {
  const revision = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT_SHA
  return revision?.trim() ? revision.trim().slice(0, 12) : null
}

/**
 * Deliberately synchronous and dependency-free.
 *
 * A draining process is still alive and must keep saying so: it has calls to
 * finish, and being restarted mid-drain is exactly the outcome draining
 * exists to avoid.
 */
export function livenessReport(): LivenessReport {
  return {
    status: 'ok',
    phase: runtimePhase(),
    activeCalls: activeRealtimeCalls(),
    callLimit: realtimeCallLimit(),
    uptimeSeconds: Math.round(process.uptime()),
    // Memory and event-loop delay, on the one endpoint that never touches a
    // dependency — so it stays readable exactly when the process is in the
    // trouble these numbers describe.
    vitals: readVitals(),
  }
}

export async function readinessReport(): Promise<ReadinessReport> {
  // Everything readiness depends on is imported here rather than at module
  // scope, so that `/api/health/live` — the endpoint the platform health
  // check calls — never builds a database pool or validates configuration
  // just to answer whether this process is running. Liveness has to be
  // decidable from process state alone; that is the whole point of splitting
  // it out, and importing these at the top would quietly re-couple them.
  const [{ db }, { env }, { protectedDataReady }, storage] = await Promise.all([
    import('@/server/db'),
    import('@/lib/env'),
    import('@/server/security/protected-data'),
    import('@/server/storage/recordings'),
  ])
  const { recordingStorageProblem, recordingStorageReady } = storage

  const databaseReady = await db
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false)

  const phase = runtimePhase()
  const voiceReady = Boolean(env.OPENAI_API_KEY && env.OPENAI_WEBHOOK_SECRET)
  const encryptionReady = protectedDataReady()
  const storageProblem = recordingStorageProblem()
  const recordingsReady = recordingStorageReady()

  const ready =
    databaseReady &&
    !storageProblem &&
    phase === 'serving' &&
    (env.NODE_ENV !== 'production' || (voiceReady && encryptionReady))

  return {
    status: ready ? 'ok' : 'degraded',
    ready,
    phase,
    revision: deploymentRevision(),
    checks: {
      database: databaseReady ? 'ok' : 'down',
      voice: voiceReady ? 'ok' : 'disabled',
      protectedData: encryptionReady ? 'ok' : 'disabled',
      recordings: storageProblem ? 'misconfigured' : recordingsReady ? 'ok' : 'disabled',
      lifecycle: phase === 'serving' ? 'ok' : 'draining',
    },
    activeCalls: activeRealtimeCalls(),
    callLimit: realtimeCallLimit(),
    timestamp: new Date().toISOString(),
  }
}
