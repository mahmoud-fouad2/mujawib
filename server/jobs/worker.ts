import 'server-only'

import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { drainCallIntelligenceJobs, enqueueCallIntelligence } from '@/server/calls/intelligence'
import { db, poolWaitMs } from '@/server/db'
import { backgroundJob, call, callEvent } from '@/server/db/schema'
import { notifyOperators, tryNotify } from '@/server/notifications/service'
import { runCampaignDispatch } from '@/server/outbound/dispatcher'
import { isDraining } from '@/server/runtime/lifecycle'
import { readVitals } from '@/server/runtime/vitals'
import { runRetentionSweep, sweepOperationalTables } from '@/server/security/retention'
import { voiceError, voiceLog } from '@/server/voice/log'
import { recoverStaleSidebands } from '@/server/voice/sideband'

let lastRetentionSweep = 0

/**
 * Closes calls the runtime stopped reporting on.
 *
 * A call that is still `live` hours later did not last hours — the sideband
 * that should have closed it went away, most often because the process
 * handling the call was replaced. The row has to be closed by something, and
 * that something is here.
 *
 * Two rules this deliberately follows:
 *
 * It does not call the result a failure. The webhook only writes a row after
 * OpenAI answers the accept, so the caller reached the agent and had whatever
 * conversation they had. What is missing is our record of it, not the call.
 * Marking those `failed` is what made every real call on the platform show up
 * as broken while the telephony path was in fact working.
 *
 * It does not invent a duration. `now - startedAt` is not how long the caller
 * was on the phone; it is how long the row sat unclosed, which is why the
 * console was showing forty-hour phone calls. We do not know the duration, so
 * the column stays null and the UI says so.
 */
async function reconcileStaleCalls() {
  const now = new Date()
  const acceptingCutoff = new Date(now.getTime() - 10 * 60 * 1000)
  const liveCutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000)

  // Never accepted: the caller heard nothing, so this one is a real failure.
  const neverAccepted = await db
    .update(call)
    .set({ status: 'accept_failed', endedAt: now, durationSeconds: null })
    .where(and(eq(call.status, 'accepting'), lt(call.startedAt, acceptingCutoff)))
    .returning({ id: call.id })

  // Accepted, then lost track of. Whether a transcript survived decides
  // whether the record is complete, not whether the call succeeded.
  const abandonedByUs = await db
    .update(call)
    .set({
      status: sql`case
        when coalesce(jsonb_array_length(${call.transcript}), 0) > 0
          or exists (
            select 1 from ${callEvent}
            where ${callEvent.callId} = ${call.id}
              and ${callEvent.type} in ('caller_turn', 'agent_turn')
          )
        then 'completed'::call_status
        else 'completed_no_transcript'::call_status
      end`,
      endedAt: now,
      durationSeconds: null,
    })
    .where(and(inArray(call.status, ['live', 'waiting_tool']), lt(call.startedAt, liveCutoff)))
    .returning({ id: call.id })

  for (const item of [...neverAccepted, ...abandonedByUs]) await enqueueCallIntelligence(item.id)
}

const MAINTENANCE_LEASE_ID = 'job_platform_maintenance'
const MAINTENANCE_LEASE_MS = 45_000

async function claimMaintenanceLease(): Promise<Date | null> {
  const now = new Date()
  await db
    .insert(backgroundJob)
    .values({
      id: MAINTENANCE_LEASE_ID,
      type: 'platform_maintenance',
      dedupeKey: 'platform:maintenance',
      payload: {},
      status: 'pending',
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: backgroundJob.dedupeKey })

  const staleBefore = new Date(now.getTime() - MAINTENANCE_LEASE_MS)
  const [claimed] = await db
    .update(backgroundJob)
    .set({
      status: 'running',
      lockedAt: now,
      attempts: sql`${backgroundJob.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(backgroundJob.id, MAINTENANCE_LEASE_ID),
        or(
          inArray(backgroundJob.status, ['pending', 'failed', 'completed']),
          and(eq(backgroundJob.status, 'running'), lt(backgroundJob.lockedAt, staleBefore)),
        ),
      ),
    )
    .returning({ lockedAt: backgroundJob.lockedAt })
  return claimed?.lockedAt ?? null
}

async function releaseMaintenanceLease(lockedAt: Date) {
  await db
    .update(backgroundJob)
    .set({ status: 'pending', lockedAt: null, lastError: null, updatedAt: new Date() })
    .where(
      and(
        eq(backgroundJob.id, MAINTENANCE_LEASE_ID),
        eq(backgroundJob.status, 'running'),
        eq(backgroundJob.lockedAt, lockedAt),
      ),
    )
}

/**
 * One line every tick carrying memory, heap headroom and event-loop delay.
 *
 * This is the line that would have explained the 2026-09-01 OOM kill. It is
 * emitted before the tick's real work, so a reading still lands even when that
 * work is what is consuming the process — and it is deliberately not awaited,
 * because a measurement must never be able to delay what it measures.
 */
function reportVitals() {
  const vitals = readVitals({ reset: true })
  voiceLog('PROCESS_VITALS', vitals)
  if (vitals.pressure === 'ok') return

  voiceError('MEMORY_PRESSURE', {
    pressure: vitals.pressure,
    heapUsedMB: vitals.heapUsedMB,
    heapLimitMB: vitals.heapLimitMB,
    rssMB: vitals.rssMB,
    heapUsedPct: vitals.heapUsedPct,
    rssPct: vitals.rssPct,
  })

  // A log line only helps someone already reading logs, and nobody reads logs
  // at 2am — which is exactly when the 2026-09-01 OOM kill happened. This
  // reaches the operator through the notification centre they already use.
  // Deduped per hour so a process sitting at high water does not produce one
  // notification every fifteen seconds.
  const hour = Math.floor(Date.now() / 3_600_000)
  void tryNotify(() =>
    notifyOperators({
      workspaceId: null,
      roles: ['owner', 'ops'],
      severity: vitals.pressure === 'critical' ? 'critical' : 'warning',
      category: 'system',
      title:
        vitals.pressure === 'critical'
          ? 'ذاكرة الخادم عند الحد الحرج'
          : 'ارتفاع استهلاك ذاكرة الخادم',
      message: `RSS ${vitals.rssMB}MB من ${vitals.containerLimitMB}MB · الكومة ${vitals.heapUsedMB}MB من ${vitals.heapLimitMB}MB${vitals.pressure === 'critical' ? ' — المكالمات الجديدة تُرفض حاليًا لحماية الجارية.' : '.'}`,
      href: '/console/system',
      sourceType: 'runtime',
      sourceId: 'memory',
      dedupeKey: `memory:${vitals.pressure}:${hour}`,
    }),
  )
}

/**
 * Publishes how long each pool currently makes a query wait for a connection.
 *
 * The audit could not say whether the database pool or the CPU was the first
 * bottleneck because neither was measured. This is the cheapest honest answer:
 * `reserve()` queues exactly like a query does, so the time it takes is the
 * queueing delay every query is already paying.
 */
async function reportPoolWait() {
  const [app, realtime] = await Promise.all([
    poolWaitMs('app').catch(() => -1),
    poolWaitMs('realtime').catch(() => -1),
  ])
  voiceLog('POOL_WAIT', { appMs: app, realtimeMs: realtime })
}

async function runMaintenanceTick() {
  // A draining process is finishing calls, not starting summaries or sweeping
  // retention. Both compete for the same CPU and connections as the calls it
  // is trying to let finish, and both are safe to leave to the next process.
  if (isDraining()) return

  const lease = await claimMaintenanceLease()
  if (!lease) return
  try {
    reportVitals()
    await reportPoolWait()
    await reconcileStaleCalls()
    await recoverStaleSidebands()
    await drainCallIntelligenceJobs()
    // Outbound campaigns. Runs under the same lease as everything else here,
    // which is what stops two containers dialling the same list — and it is
    // deliberately after the inbound-call reconciliation, because a process
    // that is behind on the calls it is already carrying has no business
    // starting new ones.
    await runCampaignDispatch()
    if (Date.now() - lastRetentionSweep > 60 * 60 * 1000) {
      await runRetentionSweep()
      const purged = await sweepOperationalTables()
      const total = Object.values(purged).reduce((sum, n) => sum + n, 0)
      if (total > 0) voiceLog('RETENTION_SWEEP', purged)
      lastRetentionSweep = Date.now()
    }
  } finally {
    await releaseMaintenanceLease(lease)
  }
}

const workerGlobal = globalThis as typeof globalThis & {
  __mujawibWorkerTimer?: NodeJS.Timeout
  __mujawibWorkerRunning?: boolean
}

function safeDatabaseError(error: unknown) {
  const root = error && typeof error === 'object' ? (error as { cause?: unknown }).cause : null
  const cause = root && typeof root === 'object' ? (root as Record<string, unknown>) : null
  return {
    message: error instanceof Error ? error.message.split('\nparams:')[0] : 'Unknown worker error',
    code: typeof cause?.code === 'string' ? cause.code : null,
    detail: typeof cause?.detail === 'string' ? cause.detail : null,
  }
}

async function reportWorkerFailure(error: unknown) {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error)
  } catch {
    // Sentry itself must never be why the maintenance tick fails.
  }
}

export function startBackgroundWorker() {
  if (workerGlobal.__mujawibWorkerTimer) return

  const tick = async () => {
    if (workerGlobal.__mujawibWorkerRunning) return
    workerGlobal.__mujawibWorkerRunning = true
    try {
      await runMaintenanceTick()
    } catch (error) {
      // Before Sentry this line was the only record a tick failed at all —
      // a dependency down for an hour looked identical to one down for a
      // minute unless someone was actively reading the Render log stream.
      console.error('[worker] maintenance tick failed', safeDatabaseError(error))
      await reportWorkerFailure(error)
    } finally {
      workerGlobal.__mujawibWorkerRunning = false
    }
  }

  void tick()
  workerGlobal.__mujawibWorkerTimer = setInterval(() => void tick(), 15_000)
  workerGlobal.__mujawibWorkerTimer.unref()
}
