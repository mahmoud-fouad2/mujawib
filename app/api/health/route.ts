import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { protectedDataReady } from '@/server/security/protected-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const databaseReady = await db
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false)
  const voiceReady = Boolean(env.OPENAI_API_KEY && env.OPENAI_WEBHOOK_SECRET)
  const encryptionReady = protectedDataReady()
  const ready = databaseReady && (env.NODE_ENV !== 'production' || (voiceReady && encryptionReady))

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      service: 'mujawib-web',
      checks: {
        database: databaseReady ? 'ok' : 'down',
        voice: voiceReady ? 'ok' : 'disabled',
        protectedData: encryptionReady ? 'ok' : 'disabled',
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
