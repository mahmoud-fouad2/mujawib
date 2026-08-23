import 'server-only'

import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { canOperator } from '@/lib/access'
import { readCallIntelligenceState } from '@/lib/call-intelligence'
import {
  capabilitiesForProvider,
  integrationSetupState,
  normalizeIntegrationConfig,
} from '@/lib/integrations'
import { buildCallSummary, normalizeTranscript } from '@/server/calls/presentation'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  booking,
  call,
  callEvent,
  changeRequest,
  customer,
  flow,
  industryTemplate,
  integrationConnection,
  knowledgeItem,
  lead,
  phoneNumber,
  pronunciation,
  qaResult,
  salesInquiry,
  scenarioRun,
  scenarioTest,
  toolExecution,
  voiceProfile,
  workspace,
} from '@/server/db/schema'
import { sqlTimestamp } from '@/server/db/values'
import { getClientReadinessById } from '@/server/operations/client-readiness'
import { revealJson } from '@/server/security/protected-data'
import { getVersionTestGate, getVersionTestGates } from '@/server/test-lab/gate'

/** Calls that are on the wire right now. */
const LIVE_STATUSES = ['live', 'ringing', 'waiting_tool'] as const

export async function getSalesInquiries(limit = 100) {
  return db
    .select({
      id: salesInquiry.id,
      name: salesInquiry.name,
      company: salesInquiry.company,
      email: salesInquiry.email,
      phone: salesInquiry.phone,
      need: salesInquiry.need,
      monthlyCalls: salesInquiry.monthlyCalls,
      locale: salesInquiry.locale,
      status: salesInquiry.status,
      ownerId: salesInquiry.ownerId,
      createdAt: salesInquiry.createdAt,
      updatedAt: salesInquiry.updatedAt,
    })
    .from(salesInquiry)
    .orderBy(desc(salesInquiry.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200))
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBack(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function liveCutoff() {
  return new Date(Date.now() - 2 * 60 * 60 * 1000)
}

/* ─── Sidebar counts ─────────────────────────────────────────────────────── */

/** Two numbers the sidebar badges — kept as one cheap query per navigation. */
export async function getNavCounts(): Promise<{ live: number; review: number }> {
  const [liveRows, reviewRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(call)
      .where(
        and(
          inArray(call.status, [...LIVE_STATUSES]),
          eq(call.origin, 'live'),
          gte(call.startedAt, liveCutoff()),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(qaResult)
      .innerJoin(call, eq(call.id, qaResult.callId))
      .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live'))),
  ])

  return { live: liveRows[0]?.n ?? 0, review: reviewRows[0]?.n ?? 0 }
}

/* ─── Operator home ──────────────────────────────────────────────────────── */

export type OperationsSummary = {
  callsToday: number
  callsPriorDay: number
  bookingsToday: number
  bookingsPriorDay: number
  resolvedRate: number
  liveNow: number
  needsReview: number
  afterHours: number
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const today = startOfToday()
  const yesterday = daysBack(1)
  const todaySql = sqlTimestamp(today)
  const yesterdaySql = sqlTimestamp(yesterday)
  const liveCutoffSql = sqlTimestamp(liveCutoff())

  const [calls] = await db
    .select({
      today: sql<number>`count(*) filter (where ${call.startedAt} >= ${todaySql})`.mapWith(Number),
      prior:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${yesterdaySql} and ${call.startedAt} < ${todaySql})`.mapWith(
          Number,
        ),
      resolvedToday:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${todaySql} and ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
          Number,
        ),
      closedToday:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${todaySql} and ${call.outcome} is not null)`.mapWith(
          Number,
        ),
      live: sql<number>`count(*) filter (where ${call.status} in ('live','ringing','waiting_tool') and ${call.startedAt} >= ${liveCutoffSql})`.mapWith(
        Number,
      ),
      afterHours:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${todaySql} and (${call.metadata} ->> 'afterHours') = 'true')`.mapWith(
          Number,
        ),
    })
    .from(call)
    .where(eq(call.origin, 'live'))

  const [bookings] = await db
    .select({
      today: sql<number>`count(*) filter (where ${booking.createdAt} >= ${todaySql})`.mapWith(
        Number,
      ),
      prior:
        sql<number>`count(*) filter (where ${booking.createdAt} >= ${yesterdaySql} and ${booking.createdAt} < ${todaySql})`.mapWith(
          Number,
        ),
    })
    .from(booking)
    .innerJoin(call, eq(booking.callId, call.id))
    .where(eq(call.origin, 'live'))

  const [review] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live')))

  const closed = calls?.closedToday ?? 0

  return {
    callsToday: calls?.today ?? 0,
    callsPriorDay: calls?.prior ?? 0,
    bookingsToday: bookings?.today ?? 0,
    bookingsPriorDay: bookings?.prior ?? 0,
    resolvedRate: closed > 0 ? Math.round(((calls?.resolvedToday ?? 0) / closed) * 100) : 0,
    liveNow: calls?.live ?? 0,
    needsReview: review?.n ?? 0,
    afterHours: calls?.afterHours ?? 0,
  }
}

export type LiveCall = {
  id: string
  callerNumber: string | null
  workspaceName: string
  status: string
  intent: string | null
  startedAt: Date
  lastEvent: string | null
  agentName: string | null
}

export async function getLiveCalls(): Promise<LiveCall[]> {
  const rows = await db
    .select({
      id: call.id,
      callerNumber: call.callerNumber,
      workspaceName: workspace.name,
      status: call.status,
      intent: call.intent,
      startedAt: call.startedAt,
      agentName: agent.name,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .leftJoin(agentVersion, eq(call.agentVersionId, agentVersion.id))
    .leftJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(
      and(
        inArray(call.status, [...LIVE_STATUSES]),
        eq(call.origin, 'live'),
        gte(call.startedAt, liveCutoff()),
      ),
    )
    .orderBy(desc(call.startedAt))
    .limit(12)

  if (rows.length === 0) return []

  const events = await db
    .select({
      callId: callEvent.callId,
      type: callEvent.type,
      occurredAt: callEvent.occurredAt,
    })
    .from(callEvent)
    .where(
      inArray(
        callEvent.callId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(desc(callEvent.occurredAt))

  const latest = new Map<string, string>()
  for (const e of events) if (!latest.has(e.callId)) latest.set(e.callId, e.type)

  return rows.map((r) => ({ ...r, lastEvent: latest.get(r.id) ?? null }))
}

export type AttentionItem = {
  callId: string
  workspaceName: string
  workspaceSlug: string
  callerNumber: string | null
  intent: string | null
  outcome: string | null
  score: number | null
  flags: string[]
  createdAt: Date
}

export async function getNeedsAttention(limit = 8): Promise<AttentionItem[]> {
  return db
    .select({
      callId: call.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      callerNumber: call.callerNumber,
      intent: call.intent,
      outcome: call.outcome,
      score: qaResult.score,
      flags: qaResult.flags,
      createdAt: qaResult.createdAt,
    })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live')))
    .orderBy(desc(qaResult.createdAt))
    .limit(limit) as Promise<AttentionItem[]>
}

export type ClientRisk = {
  workspaceId: string
  name: string
  slug: string
  transferRate: number
  unresolvedRate: number
  calls7d: number
  degradedIntegrations: number
}

export async function getClientsAtRisk(): Promise<ClientRisk[]> {
  const since = daysBack(7)

  const rows = await db
    .select({
      workspaceId: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      calls7d: sql<number>`count(${call.id})`.mapWith(Number),
      transfers: sql<number>`count(*) filter (where ${call.outcome} = 'transfer')`.mapWith(Number),
      unresolved:
        sql<number>`count(*) filter (where ${call.outcome} in ('unresolved','failed'))`.mapWith(
          Number,
        ),
    })
    .from(workspace)
    .innerJoin(
      call,
      and(eq(call.workspaceId, workspace.id), gte(call.startedAt, since), eq(call.origin, 'live')),
    )
    .where(eq(workspace.type, 'client'))
    .groupBy(workspace.id, workspace.name, workspace.slug)

  const degraded = await db
    .select({
      workspaceId: integrationConnection.workspaceId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(integrationConnection)
    .where(inArray(integrationConnection.health, ['degraded', 'failed']))
    .groupBy(integrationConnection.workspaceId)

  const degradedBy = new Map(degraded.map((d) => [d.workspaceId, d.n]))

  return rows
    .map((r) => ({
      workspaceId: r.workspaceId,
      name: r.name,
      slug: r.slug,
      calls7d: r.calls7d,
      transferRate: r.calls7d > 0 ? Math.round((r.transfers / r.calls7d) * 100) : 0,
      unresolvedRate: r.calls7d > 0 ? Math.round((r.unresolved / r.calls7d) * 100) : 0,
      degradedIntegrations: degradedBy.get(r.workspaceId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.unresolvedRate +
        b.transferRate +
        b.degradedIntegrations * 10 -
        (a.unresolvedRate + a.transferRate + a.degradedIntegrations * 10),
    )
    .slice(0, 4)
}

export type PlatformSignal = {
  key: string
  label: string
  tone: 'good' | 'warn' | 'bad'
  note: string
}

/** Bible §7: the status strip only earns its space when something is wrong. */
export async function getPlatformStatus(): Promise<PlatformSignal[]> {
  const signals: PlatformSignal[] = []

  const integrations = await db
    .select({ health: integrationConnection.health, n: sql<number>`count(*)`.mapWith(Number) })
    .from(integrationConnection)
    .groupBy(integrationConnection.health)

  const failed = integrations.find((i) => i.health === 'failed')?.n ?? 0
  const degradedCount = integrations.find((i) => i.health === 'degraded')?.n ?? 0

  if (failed > 0) {
    signals.push({
      key: 'integrations',
      label: 'التكاملات',
      tone: 'bad',
      note: `${failed} اتصال متوقف — الحجز يسقط إلى معاودة الاتصال`,
    })
  } else if (degradedCount > 0) {
    signals.push({
      key: 'integrations',
      label: 'التكاملات',
      tone: 'warn',
      note: `${degradedCount} اتصال متذبذب — زمن استجابة أعلى من المعتاد`,
    })
  }

  const [phones] = await db
    .select({
      unverified:
        sql<number>`count(*) filter (where ${phoneNumber.sipStatus} not in ('verified', 'active'))`.mapWith(
          Number,
        ),
    })
    .from(phoneNumber)

  if ((phones?.unverified ?? 0) > 0) {
    signals.push({
      key: 'telephony',
      label: 'الهاتف',
      tone: 'warn',
      note: `${phones?.unverified} رقم لم يُختبر بعد`,
    })
  }

  const [slowTools] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(toolExecution)
    .innerJoin(call, eq(toolExecution.callId, call.id))
    .where(
      and(
        gte(toolExecution.executedAt, daysBack(1)),
        eq(toolExecution.status, 'failed'),
        eq(call.origin, 'live'),
      ),
    )

  if ((slowTools?.n ?? 0) > 0) {
    signals.push({
      key: 'tools',
      label: 'الأدوات',
      tone: 'warn',
      note: `${slowTools?.n} تنفيذ فاشل خلال 24 ساعة`,
    })
  }

  return signals
}

/** Bible §7 "Recent activity" — the audit trail, read as an operations brief. */
export async function getRecentActivity(limit = 6) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      workspaceName: workspace.name,
    })
    .from(auditLog)
    .leftJoin(workspace, eq(auditLog.workspaceId, workspace.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}

/** 14-day call volume, split by whether the voice closed it alone. */
export async function getCallTrend(days = 14) {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${call.startedAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)`.mapWith(Number),
      resolved:
        sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
          Number,
        ),
    })
    .from(call)
    .where(and(gte(call.startedAt, daysBack(days)), eq(call.origin, 'live')))
    .groupBy(sql`date_trunc('day', ${call.startedAt})`)
    .orderBy(sql`date_trunc('day', ${call.startedAt})`)

  return rows
}

/**
 * Seven-day series behind each headline figure, so a number on the home screen
 * always carries a direction rather than sitting there alone.
 */
export async function getMetricTrends() {
  const since = daysBack(7)

  const [calls, bookings, reviews] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${call.startedAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)`.mapWith(Number),
        resolved:
          sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
            Number,
          ),
      })
      .from(call)
      .where(and(gte(call.startedAt, since), eq(call.origin, 'live')))
      .groupBy(sql`date_trunc('day', ${call.startedAt})`)
      .orderBy(sql`date_trunc('day', ${call.startedAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${booking.createdAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(booking)
      .innerJoin(call, eq(booking.callId, call.id))
      .where(and(gte(booking.createdAt, since), eq(call.origin, 'live')))
      .groupBy(sql`date_trunc('day', ${booking.createdAt})`)
      .orderBy(sql`date_trunc('day', ${booking.createdAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${qaResult.createdAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(qaResult)
      .innerJoin(call, eq(qaResult.callId, call.id))
      .where(and(gte(qaResult.createdAt, since), eq(call.origin, 'live')))
      .groupBy(sql`date_trunc('day', ${qaResult.createdAt})`)
      .orderBy(sql`date_trunc('day', ${qaResult.createdAt})`),
  ])

  // A day with no rows is absent from a GROUP BY, which would draw a shorter
  // line rather than a dip. Fill the gaps so every series has seven points.
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const series = (rows: { day: string; n: number }[]) => {
    const by = new Map(rows.map((r) => [r.day, r.n]))
    return days.map((d) => by.get(d) ?? 0)
  }

  const resolvedRate = days.map((d) => {
    const row = calls.find((c) => c.day === d)
    if (!row || row.n === 0) return 0
    return Math.round((row.resolved / row.n) * 100)
  })

  return {
    calls: series(calls),
    bookings: series(bookings),
    reviews: series(reviews),
    resolvedRate,
  }
}

/* ─── Clients ────────────────────────────────────────────────────────────── */

export async function getClients() {
  const since = daysBack(30)
  const [clients, calls, bookings, agents, unhealthy] = await Promise.all([
    db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        status: workspace.status,
        industryPack: workspace.industryPack,
        businessInfo: workspace.businessInfo,
        createdAt: workspace.createdAt,
      })
      .from(workspace)
      .where(eq(workspace.type, 'client'))
      .orderBy(workspace.name)
      .limit(100),
    db
      .select({ workspaceId: call.workspaceId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(call)
      .where(and(gte(call.startedAt, since), eq(call.origin, 'live')))
      .groupBy(call.workspaceId),
    db
      .select({ workspaceId: booking.workspaceId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(booking)
      .innerJoin(call, eq(booking.callId, call.id))
      .where(and(gte(booking.createdAt, since), eq(call.origin, 'live')))
      .groupBy(booking.workspaceId),
    db
      .select({ workspaceId: agent.workspaceId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(agent)
      .groupBy(agent.workspaceId),
    db
      .select({
        workspaceId: integrationConnection.workspaceId,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(integrationConnection)
      .where(inArray(integrationConnection.health, ['degraded', 'failed']))
      .groupBy(integrationConnection.workspaceId),
  ])

  const countByWorkspace = (rows: { workspaceId: string; n: number }[]) =>
    new Map(rows.map((row) => [row.workspaceId, row.n]))
  const callsByWorkspace = countByWorkspace(calls)
  const bookingsByWorkspace = countByWorkspace(bookings)
  const agentsByWorkspace = countByWorkspace(agents)
  const unhealthyByWorkspace = countByWorkspace(unhealthy)

  return clients
    .map((client) => ({
      ...client,
      calls30d: callsByWorkspace.get(client.id) ?? 0,
      bookings30d: bookingsByWorkspace.get(client.id) ?? 0,
      agents: agentsByWorkspace.get(client.id) ?? 0,
      unhealthy: unhealthyByWorkspace.get(client.id) ?? 0,
    }))
    .sort((a, b) => b.calls30d - a.calls30d)
}

async function getClientBySlug(slug: string) {
  const [row] = await db.select().from(workspace).where(eq(workspace.slug, slug)).limit(1)
  return row ?? null
}

/** Everything one client detail screen needs, in a single round of queries. */
export async function getClientDetail(slug: string) {
  const ws = await getClientBySlug(slug)
  if (!ws) return null

  const since = daysBack(30)

  const [
    totals,
    agents,
    numbers,
    integrations,
    requests,
    knowledge,
    recentCalls,
    trend,
    readiness,
  ] = await Promise.all([
    db
      .select({
        calls: sql<number>`count(*)`.mapWith(Number),
        resolved:
          sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
            Number,
          ),
        closed: sql<number>`count(*) filter (where ${call.outcome} is not null)`.mapWith(Number),
        transfers: sql<number>`count(*) filter (where ${call.outcome} = 'transfer')`.mapWith(
          Number,
        ),
        afterHours:
          sql<number>`count(*) filter (where (${call.metadata} ->> 'afterHours') = 'true')`.mapWith(
            Number,
          ),
      })
      .from(call)
      .where(and(eq(call.workspaceId, ws.id), gte(call.startedAt, since), eq(call.origin, 'live'))),
    db
      .select({
        id: agent.id,
        name: agent.name,
        liveVersionId: agent.liveVersionId,
        updatedAt: agent.updatedAt,
      })
      .from(agent)
      .where(eq(agent.workspaceId, ws.id)),
    db.select().from(phoneNumber).where(eq(phoneNumber.workspaceId, ws.id)),
    db.select().from(integrationConnection).where(eq(integrationConnection.workspaceId, ws.id)),
    db
      .select()
      .from(changeRequest)
      .where(eq(changeRequest.workspaceId, ws.id))
      .orderBy(desc(changeRequest.createdAt))
      .limit(6),
    db
      .select({ category: knowledgeItem.category, n: sql<number>`count(*)`.mapWith(Number) })
      .from(knowledgeItem)
      .where(eq(knowledgeItem.workspaceId, ws.id))
      .groupBy(knowledgeItem.category),
    db
      .select({
        id: call.id,
        callerNumber: call.callerNumber,
        intent: call.intent,
        outcome: call.outcome,
        status: call.status,
        durationSeconds: call.durationSeconds,
        startedAt: call.startedAt,
      })
      .from(call)
      .where(and(eq(call.workspaceId, ws.id), eq(call.origin, 'live')))
      .orderBy(desc(call.startedAt))
      .limit(10),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${call.startedAt}), 'YYYY-MM-DD')`,
        total: sql<number>`count(*)`.mapWith(Number),
        resolved:
          sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
            Number,
          ),
      })
      .from(call)
      .where(
        and(
          eq(call.workspaceId, ws.id),
          gte(call.startedAt, daysBack(14)),
          eq(call.origin, 'live'),
        ),
      )
      .groupBy(sql`date_trunc('day', ${call.startedAt})`)
      .orderBy(sql`date_trunc('day', ${call.startedAt})`),
    getClientReadinessById(ws.id),
  ])

  const t = totals[0] ?? { calls: 0, resolved: 0, closed: 0, transfers: 0, afterHours: 0 }

  return {
    workspace: ws,
    totals: {
      ...t,
      resolvedRate: t.closed > 0 ? Math.round((t.resolved / t.closed) * 100) : 0,
    },
    agents,
    numbers,
    integrations,
    requests,
    knowledge,
    recentCalls,
    trend,
    readiness,
  }
}

/** One agent, its version history and the scenario runs that gate release. */
export async function getAgentDetail(agentId: string) {
  const [row] = await db
    .select({
      agent,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    })
    .from(agent)
    .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
    .where(eq(agent.id, agentId))
    .limit(1)

  if (!row) return null

  const versions = await db
    .select()
    .from(agentVersion)
    .where(eq(agentVersion.agentId, agentId))
    .orderBy(desc(agentVersion.versionNumber))

  const liveVersion = versions.find((v) => v.id === row.agent.liveVersionId) ?? null
  const draft = versions.find((v) => v.status === 'draft') ?? null
  const versionUnderTest = draft ?? liveVersion
  const liveVersionId = liveVersion?.id
  const testedVersionId = versionUnderTest?.id

  const [profile, flows, runs, callStats, draftTestGate] = await Promise.all([
    liveVersion?.voiceProfileId
      ? db
          .select()
          .from(voiceProfile)
          .where(eq(voiceProfile.id, liveVersion.voiceProfileId))
          .limit(1)
      : Promise.resolve([]),
    liveVersionId
      ? db.select().from(flow).where(eq(flow.agentVersionId, liveVersionId)).orderBy(flow.sortOrder)
      : Promise.resolve([]),
    testedVersionId
      ? db
          .select({
            name: scenarioTest.name,
            category: scenarioTest.category,
            isCritical: scenarioTest.isCritical,
            passed: scenarioRun.passed,
            score: scenarioRun.score,
            ranAt: scenarioRun.ranAt,
          })
          .from(scenarioRun)
          .innerJoin(scenarioTest, eq(scenarioRun.scenarioId, scenarioTest.id))
          .where(eq(scenarioRun.agentVersionId, testedVersionId))
          .orderBy(desc(scenarioRun.ranAt))
      : Promise.resolve([]),
    liveVersion
      ? db
          .select({
            calls: sql<number>`count(*)`.mapWith(Number),
            resolved:
              sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
                Number,
              ),
            closed: sql<number>`count(*) filter (where ${call.outcome} is not null)`.mapWith(
              Number,
            ),
          })
          .from(call)
          .where(
            and(
              eq(call.agentVersionId, liveVersion.id),
              gte(call.startedAt, daysBack(30)),
              eq(call.origin, 'live'),
            ),
          )
      : Promise.resolve([]),
    draft ? getVersionTestGate(draft.id) : Promise.resolve(null),
  ])

  const stats = callStats[0] ?? { calls: 0, resolved: 0, closed: 0 }

  return {
    ...row.agent,
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    versions,
    liveVersion,
    draft,
    draftTestGate,
    voiceProfile: profile[0] ?? null,
    flows,
    runs,
    stats: {
      ...stats,
      resolvedRate: stats.closed > 0 ? Math.round((stats.resolved / stats.closed) * 100) : 0,
    },
  }
}

/* ─── Agents ─────────────────────────────────────────────────────────────── */

export async function getAgents() {
  const rows = await db
    .select({
      id: agent.id,
      name: agent.name,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      templateId: agent.templateId,
      liveVersionId: agent.liveVersionId,
      updatedAt: agent.updatedAt,
    })
    .from(agent)
    .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
    .orderBy(workspace.name)
    .limit(100)

  const versions = await db
    .select({
      id: agentVersion.id,
      agentId: agentVersion.agentId,
      versionNumber: agentVersion.versionNumber,
      status: agentVersion.status,
      readinessScore: agentVersion.readinessScore,
      blockers: agentVersion.blockers,
      publishedAt: agentVersion.publishedAt,
      voiceProfileId: agentVersion.voiceProfileId,
      updatedAt: agentVersion.updatedAt,
    })
    .from(agentVersion)
    .where(
      inArray(
        agentVersion.agentId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(desc(agentVersion.versionNumber))

  const profiles = await db.select().from(voiceProfile)
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const drafts = versions.filter((version) => version.status === 'draft')
  const testGates = await getVersionTestGates(drafts)

  return rows.map((a) => {
    const own = versions.filter((v) => v.agentId === a.id)
    const live = own.find((v) => v.id === a.liveVersionId) ?? null
    const draft = own.find((v) => v.status === 'draft') ?? null
    const draftTestGate = draft ? (testGates.get(draft.id) ?? null) : null
    return {
      ...a,
      live,
      draft,
      draftTestGate,
      versionCount: own.length,
      voiceProfile: live?.voiceProfileId ? (profileById.get(live.voiceProfileId) ?? null) : null,
    }
  })
}

/* ─── Calls ──────────────────────────────────────────────────────────────── */

export type CallFilter = 'all' | 'needs_review' | 'resolved' | 'transferred' | 'failed' | 'demo'

export async function getCalls(options: {
  filter?: CallFilter
  workspaceId?: string
  search?: string
  limit?: number
}) {
  const { filter = 'all', workspaceId, search, limit = 60 } = options

  const conditions = []
  if (workspaceId) conditions.push(eq(call.workspaceId, workspaceId))
  conditions.push(eq(call.origin, filter === 'demo' ? 'seed' : 'live'))

  if (filter === 'resolved') conditions.push(inArray(call.outcome, ['resolved', 'booking', 'lead']))
  if (filter === 'transferred') conditions.push(eq(call.outcome, 'transfer'))
  if (filter === 'failed') conditions.push(inArray(call.outcome, ['failed', 'unresolved']))

  if (search) {
    const like = `%${search}%`
    conditions.push(
      sql`(${call.callerNumber} ilike ${like} or ${call.intent} ilike ${like} or ${call.id} ilike ${like})`,
    )
  }

  if (filter === 'needs_review') {
    conditions.push(
      sql`exists (select 1 from ${qaResult} where ${qaResult.callId} = ${call.id} and ${qaResult.reviewerId} is null)`,
    )
  }

  return db
    .select({
      id: call.id,
      callerNumber: call.callerNumber,
      status: call.status,
      origin: call.origin,
      outcome: call.outcome,
      intent: call.intent,
      durationSeconds: call.durationSeconds,
      startedAt: call.startedAt,
      metadata: call.metadata,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      qaScore: qaResult.score,
      qaFlags: qaResult.flags,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .leftJoin(qaResult, eq(qaResult.callId, call.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(call.startedAt))
    .limit(limit)
}

export async function getCallDetail(id: string) {
  const [row] = await db
    .select({
      call,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      agentName: agent.name,
      versionNumber: agentVersion.versionNumber,
      phoneE164: phoneNumber.e164,
      transferDestination: phoneNumber.transferDestination,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .leftJoin(agentVersion, eq(call.agentVersionId, agentVersion.id))
    .leftJoin(agent, eq(agentVersion.agentId, agent.id))
    .leftJoin(phoneNumber, eq(call.phoneNumberId, phoneNumber.id))
    .where(eq(call.id, id))
    .limit(1)

  if (!row) return null

  const [events, rawTools, qa, relatedBooking, relatedLead] = await Promise.all([
    db.select().from(callEvent).where(eq(callEvent.callId, id)).orderBy(callEvent.occurredAt),
    db
      .select()
      .from(toolExecution)
      .where(eq(toolExecution.callId, id))
      .orderBy(toolExecution.executedAt),
    db.select().from(qaResult).where(eq(qaResult.callId, id)).limit(1),
    db.select().from(booking).where(eq(booking.callId, id)).limit(1),
    db.select().from(lead).where(eq(lead.callId, id)).limit(1),
  ])

  const transcript = normalizeTranscript(
    revealJson<unknown[]>(row.call.transcriptEncrypted, row.call.transcript ?? []),
  )
  const tools = rawTools.map((item) => ({
    ...item,
    request: revealJson(item.requestEncrypted, item.request ?? {}),
    result: revealJson(item.resultEncrypted, item.result),
  }))
  const bookingRecord = relatedBooking[0] ?? null
  const leadRecord = relatedLead[0] ?? null
  const intelligence = readCallIntelligenceState(row.call.metadata)
  const intelligenceStale =
    intelligence.state === 'processing' &&
    Date.now() - new Date(intelligence.startedAt).getTime() > 90_000

  return {
    ...row.call,
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    agentName: row.agentName,
    versionNumber: row.versionNumber,
    phoneE164: row.phoneE164,
    transferDestination: row.transferDestination,
    transcript,
    summary: buildCallSummary({
      status: row.call.status,
      outcome: row.call.outcome,
      intent: row.call.intent,
      endedAt: row.call.endedAt,
      metadata: row.call.metadata,
      transcript,
      booking: bookingRecord,
      lead: leadRecord,
      tools,
    }),
    intelligence,
    intelligenceStale,
    events,
    tools,
    qa: qa[0] ?? null,
    booking: bookingRecord,
    lead: leadRecord,
  }
}

/* ─── QA ─────────────────────────────────────────────────────────────────── */

export async function getQaQueue(limit = 40) {
  const rows = await db
    .select({
      id: qaResult.id,
      callId: qaResult.callId,
      score: qaResult.score,
      flags: qaResult.flags,
      notes: qaResult.notes,
      action: qaResult.action,
      reviewerId: qaResult.reviewerId,
      createdAt: qaResult.createdAt,
      callerNumber: call.callerNumber,
      intent: call.intent,
      outcome: call.outcome,
      durationSeconds: call.durationSeconds,
      workspaceName: workspace.name,
    })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .where(eq(call.origin, 'live'))
    .orderBy(desc(qaResult.createdAt))
    .limit(limit)

  const [totals] = await db
    .select({
      open: sql<number>`count(*) filter (where ${qaResult.reviewerId} is null)`.mapWith(Number),
      closed: sql<number>`count(*) filter (where ${qaResult.reviewerId} is not null)`.mapWith(
        Number,
      ),
      avgScore: sql<number>`coalesce(round(avg(${qaResult.score})), 0)`.mapWith(Number),
    })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .where(eq(call.origin, 'live'))

  // Flag frequency drives the queue-reason table in Bible §22.
  const flagRows = await db
    .select({ flags: qaResult.flags })
    .from(qaResult)
    .innerJoin(call, eq(qaResult.callId, call.id))
    .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live')))

  const flagCounts = new Map<string, number>()
  for (const r of flagRows) {
    for (const f of r.flags ?? []) flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1)
  }

  return {
    rows,
    totals: totals ?? { open: 0, closed: 0, avgScore: 0 },
    reasons: [...flagCounts.entries()].map(([flag, n]) => ({ flag, n })).sort((a, b) => b.n - a.n),
  }
}

/* ─── Templates ──────────────────────────────────────────────────────────── */

export async function getTemplates() {
  const templates = await db.select().from(industryTemplate).orderBy(industryTemplate.name)

  const usage = await db
    .select({ pack: workspace.industryPack, n: sql<number>`count(*)`.mapWith(Number) })
    .from(workspace)
    .where(and(eq(workspace.type, 'client'), isNotNull(workspace.industryPack)))
    .groupBy(workspace.industryPack)

  const usageBy = new Map(usage.map((u) => [u.pack, u.n]))

  return templates.map((t) => ({ ...t, clients: usageBy.get(t.packKey) ?? 0 }))
}

/** Minimal client list for pickers — avoids loading the full metrics query. */
export async function getClientOptions() {
  return db
    .select({ id: workspace.id, name: workspace.name })
    .from(workspace)
    .where(eq(workspace.type, 'client'))
    .orderBy(workspace.name)
}

/* ─── Voice Lab ──────────────────────────────────────────────────────────── */

export async function getVoiceLab() {
  const [profiles, words, runs] = await Promise.all([
    db.select().from(voiceProfile).orderBy(voiceProfile.name),
    db
      .select({
        id: pronunciation.id,
        canonical: pronunciation.canonical,
        arabicDisplay: pronunciation.arabicDisplay,
        spokenHint: pronunciation.spokenHint,
        category: pronunciation.category,
        status: pronunciation.status,
        updatedAt: pronunciation.updatedAt,
        workspaceName: workspace.name,
      })
      .from(pronunciation)
      .leftJoin(workspace, eq(pronunciation.workspaceId, workspace.id))
      .orderBy(desc(pronunciation.updatedAt))
      .limit(30),
    db
      .select({
        name: scenarioTest.name,
        category: scenarioTest.category,
        isCritical: scenarioTest.isCritical,
        passed: scenarioRun.passed,
        score: scenarioRun.score,
        ranAt: scenarioRun.ranAt,
        agentName: agent.name,
        workspaceName: workspace.name,
      })
      .from(scenarioRun)
      .innerJoin(scenarioTest, eq(scenarioRun.scenarioId, scenarioTest.id))
      .innerJoin(agentVersion, eq(scenarioRun.agentVersionId, agentVersion.id))
      .innerJoin(agent, eq(agentVersion.agentId, agent.id))
      .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
      .orderBy(desc(scenarioRun.ranAt))
      .limit(60),
  ])

  const passed = runs.filter((r) => r.passed).length
  const criticalFailed = runs.filter((r) => !r.passed && r.isCritical).length

  return {
    profiles,
    words,
    runs,
    passRate: runs.length ? Math.round((passed / runs.length) * 100) : 0,
    criticalFailed,
  }
}

/* ─── Integrations ───────────────────────────────────────────────────────── */

export async function getIntegrations() {
  const rawRows = await db
    .select({
      id: integrationConnection.id,
      provider: integrationConnection.provider,
      label: integrationConnection.label,
      health: integrationConnection.health,
      config: integrationConnection.config,
      credentialsRef: integrationConnection.credentialsRef,
      lastSuccessAt: integrationConnection.lastSuccessAt,
      lastErrorAt: integrationConnection.lastErrorAt,
      errorRate24h: integrationConnection.errorRate24h,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    })
    .from(integrationConnection)
    .innerJoin(workspace, eq(integrationConnection.workspaceId, workspace.id))
    .orderBy(workspace.name)

  const rows = rawRows.map((row) => {
    const config = normalizeIntegrationConfig(row.config)
    return {
      ...row,
      config,
      capabilities: capabilitiesForProvider(row.provider),
      setup: integrationSetupState({
        provider: row.provider,
        config,
        credentialsRef: row.credentialsRef,
      }),
    }
  })

  const executions = await db
    .select({
      toolName: toolExecution.toolName,
      total: sql<number>`count(*)`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${toolExecution.status} = 'failed')`.mapWith(
        Number,
      ),
      p95: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${toolExecution.latencyMs})), 0)`.mapWith(
        Number,
      ),
    })
    .from(toolExecution)
    .innerJoin(call, eq(toolExecution.callId, call.id))
    .where(and(gte(toolExecution.executedAt, daysBack(7)), eq(call.origin, 'live')))
    .groupBy(toolExecution.toolName)
    .orderBy(desc(sql`count(*)`))

  return { rows, executions }
}

/* ─── Phone ──────────────────────────────────────────────────────────────── */

export async function getPhoneNumbers() {
  return db
    .select({
      id: phoneNumber.id,
      workspaceId: phoneNumber.workspaceId,
      e164: phoneNumber.e164,
      label: phoneNumber.label,
      mode: phoneNumber.mode,
      sipStatus: phoneNumber.sipStatus,
      transferDestination: phoneNumber.transferDestination,
      routingRules: phoneNumber.routingRules,
      lastTestAt: phoneNumber.lastTestAt,
      verifiedAt: phoneNumber.verifiedAt,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      agentId: agent.id,
      agentName: agent.name,
      liveVersionId: agent.liveVersionId,
      liveVersionNumber: agentVersion.versionNumber,
      liveVersionStatus: agentVersion.status,
      lastSuccessfulCallAt: sql<Date | null>`(
        select max(${call.startedAt}) from ${call}
        where ${call.phoneNumberId} = ${phoneNumber.id}
          and ${call.origin} = 'live'
          and ${call.status} not in ('failed', 'accept_failed', 'route_failed')
      )`,
      calls30d: sql<number>`(
        select count(*) from ${call}
        where ${call.phoneNumberId} = ${phoneNumber.id}
          and ${call.startedAt} >= now() - interval '30 days'
          and ${call.origin} = 'live'
      )`.mapWith(Number),
    })
    .from(phoneNumber)
    .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id))
    .leftJoin(agent, eq(phoneNumber.agentId, agent.id))
    .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
    .orderBy(workspace.name)
}

export async function getPhoneNumberDetail(phoneId: string) {
  const [row] = await db
    .select({
      id: phoneNumber.id,
      workspaceId: phoneNumber.workspaceId,
      e164: phoneNumber.e164,
      label: phoneNumber.label,
      mode: phoneNumber.mode,
      sipStatus: phoneNumber.sipStatus,
      transferDestination: phoneNumber.transferDestination,
      routingRules: phoneNumber.routingRules,
      lastTestAt: phoneNumber.lastTestAt,
      verifiedAt: phoneNumber.verifiedAt,
      verificationEvidence: phoneNumber.verificationEvidence,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      agentId: agent.id,
      agentName: agent.name,
      liveVersionId: agent.liveVersionId,
      liveVersionNumber: agentVersion.versionNumber,
      liveVersionStatus: agentVersion.status,
      lastSuccessfulCallAt: sql<Date | null>`(
        select max(${call.startedAt}) from ${call}
        where ${call.phoneNumberId} = ${phoneNumber.id}
          and ${call.origin} = 'live'
          and ${call.status} not in ('failed', 'accept_failed', 'route_failed')
      )`,
    })
    .from(phoneNumber)
    .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id))
    .leftJoin(agent, eq(phoneNumber.agentId, agent.id))
    .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
    .where(eq(phoneNumber.id, phoneId))
    .limit(1)

  if (!row) return null

  const [recentCalls, availableAgents] = await Promise.all([
    db
      .select({
        id: call.id,
        status: call.status,
        outcome: call.outcome,
        callerNumber: call.callerNumber,
        origin: call.origin,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      })
      .from(call)
      .where(and(eq(call.phoneNumberId, row.id), eq(call.origin, 'live')))
      .orderBy(desc(call.startedAt))
      .limit(8),
    db
      .select({
        id: agent.id,
        name: agent.name,
        liveVersionId: agent.liveVersionId,
        versionNumber: agentVersion.versionNumber,
        versionStatus: agentVersion.status,
      })
      .from(agent)
      .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
      .where(eq(agent.workspaceId, row.workspaceId))
      .orderBy(agent.name),
  ])

  return { ...row, recentCalls, availableAgents }
}

/* ─── System ─────────────────────────────────────────────────────────────── */

export async function getSystemOverview() {
  const [counts] = await db
    .select({
      calls: sql<number>`(select count(*) from ${call})`.mapWith(Number),
      events: sql<number>`(select count(*) from ${callEvent})`.mapWith(Number),
      tools: sql<number>`(select count(*) from ${toolExecution})`.mapWith(Number),
      workspaces:
        sql<number>`(select count(*) from ${workspace} where ${workspace.type} = 'client')`.mapWith(
          Number,
        ),
      knowledge: sql<number>`(select count(*) from ${knowledgeItem})`.mapWith(Number),
      customers: sql<number>`(select count(*) from ${customer})`.mapWith(Number),
    })
    .from(sql`(select 1) as t`)

  const [latency] = await db
    .select({
      p50: sql<number>`coalesce(round(percentile_cont(0.5) within group (order by ${callEvent.latencyMs})), 0)`.mapWith(
        Number,
      ),
      p95: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${callEvent.latencyMs})), 0)`.mapWith(
        Number,
      ),
    })
    .from(callEvent)
    .where(and(eq(callEvent.type, 'agent_turn'), gte(callEvent.occurredAt, daysBack(7))))

  const audit = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      actorId: auditLog.actorId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      workspaceName: workspace.name,
    })
    .from(auditLog)
    .leftJoin(workspace, eq(auditLog.workspaceId, workspace.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(20)

  return {
    counts: counts ?? null,
    latency: latency ?? { p50: 0, p95: 0 },
    audit,
    secretHealth: await getSecretHealth(),
  }
}

const SECRET_LABEL: Record<string, string> = {
  better_auth_secret: 'مفتاح توقيع الجلسات والتحقق بخطوتين',
  data_encryption_key: 'مفتاح تشفير البيانات المحمية',
}

export type SecretHealth = {
  key: string
  label: string
  /**
   * `recent-change` means the current value took effect within the last two
   * days — the window where a locked-out account is plausibly still this
   * incident rather than something else. Older than that, it is just
   * `stable`: a true, permanent fact ("in effect since X"), not a stale alarm
   * that stays red forever after the actual problem was already resolved.
   */
  status: 'stable' | 'recent-change' | 'unknown'
  since: Date | null
}

const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

/**
 * The most recent thing known about each tracked secret, from the audit rows
 * `checkSecretDrift` writes at boot — see server/security/secret-drift.ts for
 * why this exists. `since` is when the CURRENT fingerprint took effect, which
 * is either the last recorded change or, if it has never changed, the first
 * boot that ever observed it.
 */
async function getSecretHealth(): Promise<SecretHealth[]> {
  const rows = await db
    .select({
      resourceId: auditLog.resourceId,
      action: auditLog.action,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.resourceType, 'system_secret'))
    .orderBy(auditLog.createdAt)

  const now = Date.now()

  return Object.entries(SECRET_LABEL).map(([key, label]) => {
    const forKey = rows.filter((r) => r.resourceId === key)
    const last = forKey[forKey.length - 1]
    if (!last) return { key, label, status: 'unknown' as const, since: null }

    const recent = now - last.createdAt.getTime() < RECENT_WINDOW_MS
    return {
      key,
      label,
      status: recent ? ('recent-change' as const) : ('stable' as const),
      since: last.createdAt,
    }
  })
}

/* ─── Command palette index ──────────────────────────────────────────────── */

export async function getCommandIndex(role: string) {
  const [clients, agents, numbers] = await Promise.all([
    canOperator(role, 'client.manage')
      ? db
          .select({ name: workspace.name, slug: workspace.slug })
          .from(workspace)
          .where(and(eq(workspace.type, 'client'), ne(workspace.status, 'paused')))
      : Promise.resolve([]),
    canOperator(role, 'agent.publish')
      ? db
          .select({ name: agent.name, workspaceName: workspace.name })
          .from(agent)
          .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
      : Promise.resolve([]),
    canOperator(role, 'phone.manage')
      ? db
          .select({ e164: phoneNumber.e164, workspaceName: workspace.name })
          .from(phoneNumber)
          .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id))
      : Promise.resolve([]),
  ])

  return { clients, agents, numbers }
}
