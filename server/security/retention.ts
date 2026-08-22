import 'server-only'

import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { auditLog, booking, call, lead, workspace } from '@/server/db/schema'

const MAX_BATCH = 500

function retentionDays(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const match = /^(\d{1,4})d$/.exec(value.trim())
  if (!match) return fallback
  const days = Number(match[1])
  return days >= 1 && days <= 3650 ? days : fallback
}

function cutoff(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function auditId(workspaceId: string) {
  return `audit_retention_${workspaceId}_${Date.now()}`
}

export async function runRetentionSweep() {
  const workspaces = await db
    .select({ id: workspace.id, policy: workspace.retentionPolicy })
    .from(workspace)

  for (const item of workspaces) {
    const policy = item.policy ?? {}
    const transcriptCutoff = cutoff(retentionDays(policy.transcripts, 180))
    const callCutoff = cutoff(retentionDays(policy.calls, 180))
    const eligible = sql`coalesce(${call.metadata} ->> 'legalHold', 'false') <> 'true'`

    const expiredTranscripts = await db
      .select({ id: call.id })
      .from(call)
      .where(
        and(
          eq(call.workspaceId, item.id),
          eq(call.origin, 'live'),
          lt(call.startedAt, transcriptCutoff),
          eligible,
          sql`${call.transcriptEncrypted} is not null or ${call.transcript} <> '[]'::jsonb`,
        ),
      )
      .limit(MAX_BATCH)

    if (expiredTranscripts.length > 0) {
      await db
        .update(call)
        .set({ transcript: [], transcriptEncrypted: null })
        .where(
          inArray(
            call.id,
            expiredTranscripts.map(({ id }) => id),
          ),
        )
    }

    const expiredCalls = await db
      .select({ id: call.id })
      .from(call)
      .where(
        and(
          eq(call.workspaceId, item.id),
          eq(call.origin, 'live'),
          lt(call.startedAt, callCutoff),
          eligible,
          ne(call.status, 'live'),
        ),
      )
      .limit(MAX_BATCH)

    if (expiredCalls.length > 0) {
      const callIds = expiredCalls.map(({ id }) => id)
      await db.transaction(async (tx) => {
        await tx.update(booking).set({ callId: null }).where(inArray(booking.callId, callIds))
        await tx.update(lead).set({ callId: null }).where(inArray(lead.callId, callIds))
        await tx.delete(call).where(inArray(call.id, callIds))
      })
    }

    if (expiredTranscripts.length > 0 || expiredCalls.length > 0) {
      await db.insert(auditLog).values({
        id: auditId(item.id),
        workspaceId: item.id,
        actorId: 'retention-worker',
        action: 'retention.applied',
        resourceType: 'workspace',
        resourceId: item.id,
        metadata: {
          transcriptsPurged: expiredTranscripts.length,
          callsPurged: expiredCalls.length,
        },
        createdAt: new Date(),
      })
    }
  }
}
