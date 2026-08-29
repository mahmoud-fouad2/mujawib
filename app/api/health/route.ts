import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { protectedDataReady } from '@/server/security/protected-data'
import { recordingStorageProblem, recordingStorageReady } from '@/server/storage/recordings'

export const dynamic = 'force-dynamic'

function deploymentRevision() {
  const revision = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT_SHA
  return revision?.trim() ? revision.trim().slice(0, 12) : null
}

export async function GET() {
  const databaseReady = await db
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false)
  const voiceReady = Boolean(env.OPENAI_API_KEY && env.OPENAI_WEBHOOK_SECRET)
  const encryptionReady = protectedDataReady()
  const storageProblem = recordingStorageProblem()
  const recordingsReady = recordingStorageReady()
  const ready =
    databaseReady &&
    !storageProblem &&
    (env.NODE_ENV !== 'production' || (voiceReady && encryptionReady))

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      service: 'mujawib-web',
      revision: deploymentRevision(),
      checks: {
        database: databaseReady ? 'ok' : 'down',
        voice: voiceReady ? 'ok' : 'disabled',
        protectedData: encryptionReady ? 'ok' : 'disabled',
        recordings: storageProblem ? 'misconfigured' : recordingsReady ? 'ok' : 'disabled',
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
