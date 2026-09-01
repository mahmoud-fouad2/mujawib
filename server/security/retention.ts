import 'server-only'

import { and, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import {
  auditLog,
  backgroundJob,
  booking,
  call,
  callEvent,
  lead,
  notification,
  siteEvent,
  webhookReceipt,
  workspace,
} from '@/server/db/schema'

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
          sql`${call.transcriptEncrypted} is not null
            or ${call.transcript} <> '[]'::jsonb
            or exists (
              select 1 from ${callEvent}
              where ${callEvent.callId} = ${call.id}
                and ${callEvent.type} in ('caller_turn', 'agent_turn')
                and ${callEvent.payloadEncrypted} is not null
            )`,
        ),
      )
      .limit(MAX_BATCH)

    if (expiredTranscripts.length > 0) {
      const callIds = expiredTranscripts.map(({ id }) => id)
      await db
        .update(callEvent)
        .set({ payloadEncrypted: null })
        .where(
          and(
            inArray(callEvent.callId, callIds),
            inArray(callEvent.type, ['caller_turn', 'agent_turn']),
          ),
        )
      await db
        .update(call)
        .set({ transcript: [], transcriptEncrypted: null })
        .where(inArray(call.id, callIds))
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

/**
 * Operational tables that grow with traffic and nothing was deleting.
 *
 * The sweep above exists for a privacy obligation: it purges what a client's
 * retention policy says must not be kept. That left every *operational* table
 * growing without bound — a `background_job` row per call kept forever, a
 * `webhook_receipt` per inbound event, a `site_event` per page view, and an
 * audit and notification trail that only ever appends. None of it is read
 * after a short window, and all of it is scanned by queries that run every
 * fifteen seconds. This is the slow kind of failure: nothing is wrong for
 * months, then everything is a little slower and no single change explains it.
 *
 * Windows are chosen by what the data is actually for, not by a uniform
 * number. Audit rows are the exception and are deliberately kept longest:
 * they are the record of who did what.
 */
const OPERATIONAL_RETENTION_DAYS = {
  /** Finished jobs. A live lease is never touched — see the status filter. */
  backgroundJob: 7,
  /** Only useful while a redelivery is still possible. */
  webhookReceipt: 30,
  /** Read as aggregates on the marketing dashboard, not row by row. */
  siteEvent: 180,
  /** Already delivered and read by their recipient. */
  notification: 90,
  /** Longest on purpose: this is the accountability trail. */
  auditLog: 365,
} as const

export async function sweepOperationalTables(): Promise<Record<string, number>> {
  const purged: Record<string, number> = {}

  // Terminal states only. A `pending` or `running` job may be a live call's
  // sideband lease, and deleting one would strand the call it belongs to.
  const jobs = await db
    .delete(backgroundJob)
    .where(
      and(
        inArray(backgroundJob.status, ['completed', 'dead']),
        lt(backgroundJob.updatedAt, cutoff(OPERATIONAL_RETENTION_DAYS.backgroundJob)),
      ),
    )
    .returning({ id: backgroundJob.id })
  purged.backgroundJob = jobs.length

  const receipts = await db
    .delete(webhookReceipt)
    .where(lt(webhookReceipt.updatedAt, cutoff(OPERATIONAL_RETENTION_DAYS.webhookReceipt)))
    .returning({ id: webhookReceipt.id })
  purged.webhookReceipt = receipts.length

  const events = await db
    .delete(siteEvent)
    .where(lt(siteEvent.createdAt, cutoff(OPERATIONAL_RETENTION_DAYS.siteEvent)))
    .returning({ id: siteEvent.id })
  purged.siteEvent = events.length

  // Unread notifications survive: an alert nobody has seen is still doing its
  // job, however old it is.
  const notices = await db
    .delete(notification)
    .where(
      and(
        isNotNull(notification.readAt),
        lt(notification.createdAt, cutoff(OPERATIONAL_RETENTION_DAYS.notification)),
      ),
    )
    .returning({ id: notification.id })
  purged.notification = notices.length

  const audits = await db
    .delete(auditLog)
    .where(lt(auditLog.createdAt, cutoff(OPERATIONAL_RETENTION_DAYS.auditLog)))
    .returning({ id: auditLog.id })
  purged.auditLog = audits.length

  return purged
}
