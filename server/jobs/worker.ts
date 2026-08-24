import 'server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { drainCallIntelligenceJobs, enqueueCallIntelligence } from '@/server/calls/intelligence'
import { db } from '@/server/db'
import { call } from '@/server/db/schema'
import { runRetentionSweep } from '@/server/security/retention'
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
          or ${call.transcriptEncrypted} is not null
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

const ADVISORY_LOCK_ID = 8472910

async function runMaintenanceTick() {
  await db.transaction(async (tx) => {
    const [lock] = (await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) as acquired`,
    )) as unknown as [{ acquired: boolean } | undefined]
    if (!lock?.acquired) return

    await reconcileStaleCalls()
    await recoverStaleSidebands()
    await drainCallIntelligenceJobs()
    if (Date.now() - lastRetentionSweep > 60 * 60 * 1000) {
      await runRetentionSweep()
      lastRetentionSweep = Date.now()
    }
  })
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

export function startBackgroundWorker() {
  if (workerGlobal.__mujawibWorkerTimer) return

  const tick = async () => {
    if (workerGlobal.__mujawibWorkerRunning) return
    workerGlobal.__mujawibWorkerRunning = true
    try {
      await runMaintenanceTick()
    } catch (error) {
      console.error('[worker] maintenance tick failed', safeDatabaseError(error))
    } finally {
      workerGlobal.__mujawibWorkerRunning = false
    }
  }

  void tick()
  workerGlobal.__mujawibWorkerTimer = setInterval(() => void tick(), 15_000)
  workerGlobal.__mujawibWorkerTimer.unref()
}
