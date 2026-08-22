import 'server-only'

import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { drainCallIntelligenceJobs, enqueueCallIntelligence } from '@/server/calls/intelligence'
import { db } from '@/server/db'
import { call } from '@/server/db/schema'
import { runRetentionSweep } from '@/server/security/retention'
import { recoverStaleSidebands } from '@/server/voice/sideband'

let lastRetentionSweep = 0

async function reconcileStaleCalls() {
  const now = new Date()
  const acceptingCutoff = new Date(now.getTime() - 10 * 60 * 1000)
  const liveCutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000)
  const stale = await db
    .update(call)
    .set({
      status: 'failed',
      endedAt: now,
      durationSeconds: sql`greatest(0, round(extract(epoch from (now() - ${call.startedAt}))))`,
    })
    .where(
      or(
        and(eq(call.status, 'accepting'), lt(call.startedAt, acceptingCutoff)),
        and(inArray(call.status, ['live', 'waiting_tool']), lt(call.startedAt, liveCutoff)),
      ),
    )
    .returning({ id: call.id })

  for (const item of stale) await enqueueCallIntelligence(item.id)
}

async function runMaintenanceTick() {
  await reconcileStaleCalls()
  await recoverStaleSidebands()
  await drainCallIntelligenceJobs()
  if (Date.now() - lastRetentionSweep > 60 * 60 * 1000) {
    await runRetentionSweep()
    lastRetentionSweep = Date.now()
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
