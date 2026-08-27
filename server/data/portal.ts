import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { getPortalAccess } from '@/server/auth/access'
import { buildCallSummary, normalizeTranscript } from '@/server/calls/presentation'
import { db } from '@/server/db'
import {
  booking,
  call,
  changeRequest,
  customer,
  integrationConnection,
  knowledgeItem,
  lead,
  qaResult,
  toolExecution,
  workspace,
} from '@/server/db/schema'
import { sqlTimestamp } from '@/server/db/values'
import { revealJson } from '@/server/security/protected-data'

/**
 * Client Portal data — Bible §20. Everything here answers a business question.
 * Model names, prompts, latency numbers and credentials never cross this line.
 */

function daysBack(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

/** The portal resolves only a workspace explicitly granted to the current identity. */
export async function getPortalWorkspace(slug?: string) {
  const access = await getPortalAccess(slug)
  return access ? { ...access.workspace, accessRole: access.role } : null
}

export type PortalSummary = {
  answered: number
  answeredPrior: number
  bookings: number
  bookingsPrior: number
  resolvedRate: number
  afterHours: number
  leads: number
  transfers: number
}

export async function getPortalSummary(workspaceId: string): Promise<PortalSummary> {
  const since = daysBack(30)
  const priorStart = daysBack(60)
  const sinceSql = sqlTimestamp(since)
  const priorStartSql = sqlTimestamp(priorStart)

  const [calls] = await db
    .select({
      answered: sql<number>`count(*) filter (where ${call.startedAt} >= ${sinceSql})`.mapWith(
        Number,
      ),
      answeredPrior:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${priorStartSql} and ${call.startedAt} < ${sinceSql})`.mapWith(
          Number,
        ),
      resolved:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${sinceSql} and ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
          Number,
        ),
      closed:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${sinceSql} and ${call.outcome} is not null)`.mapWith(
          Number,
        ),
      afterHours:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${sinceSql} and (${call.metadata} ->> 'afterHours') = 'true')`.mapWith(
          Number,
        ),
      transfers:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${sinceSql} and ${call.outcome} = 'transfer')`.mapWith(
          Number,
        ),
    })
    .from(call)
    .where(and(eq(call.workspaceId, workspaceId), eq(call.origin, 'live')))

  const [bookings] = await db
    .select({
      current: sql<number>`count(*) filter (where ${booking.createdAt} >= ${sinceSql})`.mapWith(
        Number,
      ),
      prior:
        sql<number>`count(*) filter (where ${booking.createdAt} >= ${priorStartSql} and ${booking.createdAt} < ${sinceSql})`.mapWith(
          Number,
        ),
    })
    .from(booking)
    .innerJoin(call, eq(booking.callId, call.id))
    .where(and(eq(booking.workspaceId, workspaceId), eq(call.origin, 'live')))

  const [leads] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(lead)
    .innerJoin(call, eq(lead.callId, call.id))
    .where(
      and(eq(lead.workspaceId, workspaceId), eq(call.origin, 'live'), gte(lead.createdAt, since)),
    )

  const closed = calls?.closed ?? 0

  return {
    answered: calls?.answered ?? 0,
    answeredPrior: calls?.answeredPrior ?? 0,
    bookings: bookings?.current ?? 0,
    bookingsPrior: bookings?.prior ?? 0,
    resolvedRate: closed > 0 ? Math.round(((calls?.resolved ?? 0) / closed) * 100) : 0,
    afterHours: calls?.afterHours ?? 0,
    leads: leads?.n ?? 0,
    transfers: calls?.transfers ?? 0,
  }
}

/** Bible §20 "Top reasons for calling". */
export async function getTopReasons(workspaceId: string) {
  const rows = await db
    .select({ intent: call.intent, n: sql<number>`count(*)`.mapWith(Number) })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        eq(call.origin, 'live'),
        gte(call.startedAt, daysBack(30)),
      ),
    )
    .groupBy(call.intent)
    .orderBy(desc(sql`count(*)`))
    .limit(6)

  const total = rows.reduce((sum, r) => sum + r.n, 0)
  return rows.map((r) => ({
    reason: r.intent ?? 'غير محدد',
    n: r.n,
    share: total > 0 ? Math.round((r.n / total) * 100) : 0,
  }))
}

/**
 * Bible §20 "What changed?" — derived from the data rather than authored, so it
 * can never drift out of sync with what the numbers actually say.
 */
export async function getPortalInsights(workspaceId: string) {
  const summary = await getPortalSummary(workspaceId)
  const reasons = await getTopReasons(workspaceId)
  const insights: { text: string; tone: 'good' | 'warn' | 'neutral' }[] = []

  const callDelta =
    summary.answeredPrior > 0
      ? Math.round(((summary.answered - summary.answeredPrior) / summary.answeredPrior) * 100)
      : 0
  if (Math.abs(callDelta) >= 5) {
    insights.push({
      text:
        callDelta > 0
          ? `عدد المكالمات المُجابة ارتفع ${callDelta}% مقارنة بالثلاثين يومًا السابقة.`
          : `عدد المكالمات المُجابة انخفض ${Math.abs(callDelta)}% مقارنة بالثلاثين يومًا السابقة.`,
      tone: callDelta > 0 ? 'good' : 'neutral',
    })
  }

  const bookingDelta =
    summary.bookingsPrior > 0
      ? Math.round(((summary.bookings - summary.bookingsPrior) / summary.bookingsPrior) * 100)
      : 0
  if (summary.bookings > 0) {
    insights.push({
      text:
        bookingDelta >= 0
          ? `${summary.bookings} حجزًا تم إنجازه صوتيًا${bookingDelta ? ` — بزيادة ${bookingDelta}%` : ''}.`
          : `الحجوزات انخفضت ${Math.abs(bookingDelta)}% — راجع المكالمات التي انتهت بمعاودة اتصال.`,
      tone: bookingDelta >= 0 ? 'good' : 'warn',
    })
  }

  if (summary.afterHours > 0) {
    insights.push({
      text: `${summary.afterHours} مكالمة خارج ساعات العمل تمت معالجتها بدل أن تضيع.`,
      tone: 'good',
    })
  }

  const transferRate =
    summary.answered > 0 ? Math.round((summary.transfers / summary.answered) * 100) : 0
  if (transferRate > 18) {
    insights.push({
      text: `${transferRate}% من المكالمات تُحوَّل للفريق — أعلى من المستهدف، والسبب الأكثر تكرارًا هو «${reasons[0]?.reason ?? 'غير محدد'}».`,
      tone: 'warn',
    })
  }

  return insights.slice(0, 4)
}

export async function getPortalCalls(workspaceId: string, limit = 40) {
  return db
    .select({
      id: call.id,
      callerNumber: call.callerNumber,
      intent: call.intent,
      outcome: call.outcome,
      status: call.status,
      durationSeconds: call.durationSeconds,
      startedAt: call.startedAt,
      metadata: call.metadata,
    })
    .from(call)
    .where(and(eq(call.workspaceId, workspaceId), eq(call.origin, 'live')))
    .orderBy(desc(call.startedAt))
    .limit(limit)
}

/** Client-safe detail: business result and conversation, never provider internals. */
export async function getPortalCallDetail(workspaceId: string, callId: string) {
  const [row] = await db
    .select({
      id: call.id,
      callerNumber: call.callerNumber,
      intent: call.intent,
      outcome: call.outcome,
      status: call.status,
      durationSeconds: call.durationSeconds,
      transcript: call.transcript,
      transcriptEncrypted: call.transcriptEncrypted,
      recordingStatus: call.recordingStatus,
      metadata: call.metadata,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
    })
    .from(call)
    .where(and(eq(call.id, callId), eq(call.workspaceId, workspaceId), eq(call.origin, 'live')))
    .limit(1)

  if (!row) return null

  const [relatedBooking, relatedLead, tools] = await Promise.all([
    db.select().from(booking).where(eq(booking.callId, callId)).limit(1),
    db.select().from(lead).where(eq(lead.callId, callId)).limit(1),
    db
      .select({ toolName: toolExecution.toolName, status: toolExecution.status })
      .from(toolExecution)
      .where(eq(toolExecution.callId, callId)),
  ])
  const transcript = normalizeTranscript(
    revealJson<unknown[]>(row.transcriptEncrypted, row.transcript ?? []),
  )
  const bookingRecord = relatedBooking[0] ?? null
  const leadRecord = relatedLead[0] ?? null
  const metadata = row.metadata ?? {}

  return {
    id: row.id,
    callerNumber: row.callerNumber,
    intent: row.intent,
    outcome: row.outcome,
    status: row.status,
    durationSeconds: row.durationSeconds,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    recordingStatus: row.recordingStatus,
    branch: typeof metadata.branch === 'string' ? metadata.branch : null,
    transcript,
    summary: buildCallSummary({
      status: row.status,
      outcome: row.outcome,
      intent: row.intent,
      endedAt: row.endedAt,
      metadata,
      transcript,
      booking: bookingRecord,
      lead: leadRecord,
      tools,
    }),
    booking: bookingRecord
      ? {
          service: bookingRecord.service,
          scheduledAt: bookingRecord.scheduledAt,
          status: bookingRecord.status,
        }
      : null,
    lead: leadRecord ? { interest: leadRecord.interest, status: leadRecord.status } : null,
  }
}

export async function getPortalBookings(workspaceId: string, limit = 40) {
  return db
    .select({
      id: booking.id,
      workspaceId: booking.workspaceId,
      callId: booking.callId,
      externalId: booking.externalId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      service: booking.service,
      scheduledAt: booking.scheduledAt,
      status: booking.status,
      metadata: booking.metadata,
      createdAt: booking.createdAt,
    })
    .from(booking)
    .innerJoin(call, eq(booking.callId, call.id))
    .where(and(eq(booking.workspaceId, workspaceId), eq(call.origin, 'live')))
    .orderBy(desc(booking.scheduledAt))
    .limit(limit)
}

export async function getPortalCustomers(workspaceId: string, limit = 40) {
  return db
    .select({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags,
      lastCallAt: customer.lastCallAt,
      calls: sql<number>`(
        select count(*) from ${call}
        where ${call.workspaceId} = ${workspaceId}
          and ${call.callerNumber} = ${customer.phone}
          and ${call.origin} = 'live'
      )`.mapWith(Number),
      bookings: sql<number>`(
        select count(*) from ${booking}
        where ${booking.workspaceId} = ${workspaceId}
          and ${booking.customerPhone} = ${customer.phone}
          and exists (
            select 1 from ${call}
            where ${call.id} = ${booking.callId} and ${call.origin} = 'live'
          )
      )`.mapWith(Number),
    })
    .from(customer)
    .where(
      and(
        eq(customer.workspaceId, workspaceId),
        sql`exists (
          select 1 from ${call}
          where ${call.workspaceId} = ${workspaceId}
            and ${call.callerNumber} = ${customer.phone}
            and ${call.origin} = 'live'
        )`,
      ),
    )
    .orderBy(desc(customer.lastCallAt))
    .limit(limit)
}

/** Daily volume + outcome mix for the insights page. */
export async function getPortalTrend(workspaceId: string, days = 30) {
  return db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${call.startedAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)`.mapWith(Number),
      bookings: sql<number>`count(*) filter (where ${call.outcome} = 'booking')`.mapWith(Number),
      transfers: sql<number>`count(*) filter (where ${call.outcome} = 'transfer')`.mapWith(Number),
    })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        eq(call.origin, 'live'),
        gte(call.startedAt, daysBack(days)),
      ),
    )
    .groupBy(sql`date_trunc('day', ${call.startedAt})`)
    .orderBy(sql`date_trunc('day', ${call.startedAt})`)
}

/** Hour-of-day distribution — shows the after-hours window the voice covers. */
export async function getPortalHourly(workspaceId: string) {
  return db
    .select({
      hour: sql<number>`extract(hour from ${call.startedAt})`.mapWith(Number),
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(call)
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        eq(call.origin, 'live'),
        gte(call.startedAt, daysBack(30)),
      ),
    )
    .groupBy(sql`extract(hour from ${call.startedAt})`)
    .orderBy(sql`extract(hour from ${call.startedAt})`)
}

export async function getPortalBusinessInfo(workspaceId: string) {
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1)
  const items = await db
    .select()
    .from(knowledgeItem)
    .where(eq(knowledgeItem.workspaceId, workspaceId))
    .orderBy(knowledgeItem.category, knowledgeItem.title)
  return { workspace: ws ?? null, items }
}

/** The client sees connection state only — never credentials (Bible §5). */
export async function getPortalIntegrations(workspaceId: string) {
  return db
    .select({
      id: integrationConnection.id,
      provider: integrationConnection.provider,
      label: integrationConnection.label,
      health: integrationConnection.health,
      lastSuccessAt: integrationConnection.lastSuccessAt,
    })
    .from(integrationConnection)
    .where(eq(integrationConnection.workspaceId, workspaceId))
    .orderBy(integrationConnection.label)
}

export async function getPortalRequests(workspaceId: string) {
  return db
    .select()
    .from(changeRequest)
    .where(eq(changeRequest.workspaceId, workspaceId))
    .orderBy(desc(changeRequest.createdAt))
}

/** Agent health, stated as an operating condition rather than a score. */
export async function getPortalAgentHealth(workspaceId: string) {
  const [row] = await db
    .select({
      avgScore: sql<number>`coalesce(round(avg(${qaResult.score})), 0)`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${qaResult.reviewerId} is null)`.mapWith(Number),
    })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .where(
      and(
        eq(call.workspaceId, workspaceId),
        eq(call.origin, 'live'),
        gte(qaResult.createdAt, daysBack(30)),
      ),
    )

  const open = row?.open ?? 0
  return {
    state: open > 12 ? 'needs_attention' : ('excellent' as 'excellent' | 'needs_attention'),
    label: open > 12 ? 'يحتاج مراجعة' : 'مستقر',
    openReviews: open,
    avgScore: row?.avgScore ?? 0,
  }
}
