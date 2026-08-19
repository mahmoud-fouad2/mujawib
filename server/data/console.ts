import 'server-only'

import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm'
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
  scenarioRun,
  scenarioTest,
  toolExecution,
  voiceProfile,
  workspace,
} from '@/server/db/schema'

/** Calls that are on the wire right now. */
const LIVE_STATUSES = ['live', 'ringing', 'waiting_tool'] as const

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

/* ─── Sidebar counts ─────────────────────────────────────────────────────── */

/** Two numbers the sidebar badges — kept as one cheap query per navigation. */
export async function getNavCounts(): Promise<{ live: number; review: number }> {
  const [row] = await db
    .select({
      live: sql<number>`(
        select count(*) from ${call} where ${call.status} in ('live','ringing','waiting_tool')
      )`.mapWith(Number),
      review: sql<number>`(
        select count(*) from ${qaResult} where ${qaResult.reviewerId} is null
      )`.mapWith(Number),
    })
    .from(sql`(select 1) as t`)

  return { live: row?.live ?? 0, review: row?.review ?? 0 }
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

  const [calls] = await db
    .select({
      today: sql<number>`count(*) filter (where ${call.startedAt} >= ${today})`.mapWith(Number),
      prior:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${yesterday} and ${call.startedAt} < ${today})`.mapWith(
          Number,
        ),
      resolvedToday:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${today} and ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
          Number,
        ),
      closedToday:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${today} and ${call.outcome} is not null)`.mapWith(
          Number,
        ),
      live: sql<number>`count(*) filter (where ${call.status} in ('live','ringing','waiting_tool'))`.mapWith(
        Number,
      ),
      afterHours:
        sql<number>`count(*) filter (where ${call.startedAt} >= ${today} and (${call.metadata} ->> 'afterHours') = 'true')`.mapWith(
          Number,
        ),
    })
    .from(call)

  const [bookings] = await db
    .select({
      today: sql<number>`count(*) filter (where ${booking.createdAt} >= ${today})`.mapWith(Number),
      prior:
        sql<number>`count(*) filter (where ${booking.createdAt} >= ${yesterday} and ${booking.createdAt} < ${today})`.mapWith(
          Number,
        ),
    })
    .from(booking)

  const [review] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(qaResult)
    .where(sql`${qaResult.reviewerId} is null`)

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
    .where(inArray(call.status, [...LIVE_STATUSES]))
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
    .where(sql`${qaResult.reviewerId} is null`)
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
    .innerJoin(call, and(eq(call.workspaceId, workspace.id), gte(call.startedAt, since)))
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
        sql<number>`count(*) filter (where ${phoneNumber.sipStatus} <> 'verified')`.mapWith(Number),
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
    .where(and(gte(toolExecution.executedAt, daysBack(1)), eq(toolExecution.success, 'false')))

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
    .where(gte(call.startedAt, daysBack(days)))
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
      .where(gte(call.startedAt, since))
      .groupBy(sql`date_trunc('day', ${call.startedAt})`)
      .orderBy(sql`date_trunc('day', ${call.startedAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${booking.createdAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(booking)
      .where(gte(booking.createdAt, since))
      .groupBy(sql`date_trunc('day', ${booking.createdAt})`)
      .orderBy(sql`date_trunc('day', ${booking.createdAt})`),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${qaResult.createdAt}), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(qaResult)
      .where(gte(qaResult.createdAt, since))
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
  const rows = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      industryPack: workspace.industryPack,
      businessInfo: workspace.businessInfo,
      createdAt: workspace.createdAt,
      calls30d: sql<number>`(
        select count(*) from ${call}
        where ${call.workspaceId} = ${workspace.id}
          and ${call.startedAt} >= now() - interval '30 days'
      )`.mapWith(Number),
      bookings30d: sql<number>`(
        select count(*) from ${booking}
        where ${booking.workspaceId} = ${workspace.id}
          and ${booking.createdAt} >= now() - interval '30 days'
      )`.mapWith(Number),
      agents: sql<number>`(
        select count(*) from ${agent} where ${agent.workspaceId} = ${workspace.id}
      )`.mapWith(Number),
      unhealthy: sql<number>`(
        select count(*) from ${integrationConnection}
        where ${integrationConnection.workspaceId} = ${workspace.id}
          and ${integrationConnection.health} in ('degraded','failed')
      )`.mapWith(Number),
    })
    .from(workspace)
    .where(eq(workspace.type, 'client'))
    .orderBy(
      desc(sql`(
      select count(*) from ${call}
      where ${call.workspaceId} = ${workspace.id}
        and ${call.startedAt} >= now() - interval '30 days'
    )`),
    )

  return rows
}

export async function getClientBySlug(slug: string) {
  const [row] = await db.select().from(workspace).where(eq(workspace.slug, slug)).limit(1)
  return row ?? null
}

/** Everything one client detail screen needs, in a single round of queries. */
export async function getClientDetail(slug: string) {
  const ws = await getClientBySlug(slug)
  if (!ws) return null

  const since = daysBack(30)

  const [totals, agents, numbers, integrations, requests, knowledge, recentCalls, trend] =
    await Promise.all([
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
        .where(and(eq(call.workspaceId, ws.id), gte(call.startedAt, since))),
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
        .where(eq(call.workspaceId, ws.id))
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
        .where(and(eq(call.workspaceId, ws.id), gte(call.startedAt, daysBack(14))))
        .groupBy(sql`date_trunc('day', ${call.startedAt})`)
        .orderBy(sql`date_trunc('day', ${call.startedAt})`),
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

  const [profile, flows, runs, callStats] = await Promise.all([
    liveVersion?.voiceProfileId
      ? db
          .select()
          .from(voiceProfile)
          .where(eq(voiceProfile.id, liveVersion.voiceProfileId))
          .limit(1)
      : Promise.resolve([]),
    liveVersion
      ? db
          .select()
          .from(flow)
          .where(eq(flow.agentVersionId, liveVersion.id))
          .orderBy(flow.sortOrder)
      : Promise.resolve([]),
    liveVersion
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
          .where(eq(scenarioRun.agentVersionId, liveVersion.id))
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
          .where(and(eq(call.agentVersionId, liveVersion.id), gte(call.startedAt, daysBack(30))))
      : Promise.resolve([]),
  ])

  const stats = callStats[0] ?? { calls: 0, resolved: 0, closed: 0 }

  return {
    ...row.agent,
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    versions,
    liveVersion,
    draft,
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
    })
    .from(agentVersion)
    .orderBy(desc(agentVersion.versionNumber))

  const profiles = await db.select().from(voiceProfile)
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  return rows.map((a) => {
    const own = versions.filter((v) => v.agentId === a.id)
    const live = own.find((v) => v.id === a.liveVersionId) ?? null
    const draft = own.find((v) => v.status === 'draft') ?? null
    return {
      ...a,
      live,
      draft,
      versionCount: own.length,
      voiceProfile: live?.voiceProfileId ? (profileById.get(live.voiceProfileId) ?? null) : null,
    }
  })
}

/* ─── Calls ──────────────────────────────────────────────────────────────── */

export type CallFilter = 'all' | 'needs_review' | 'resolved' | 'transferred' | 'failed'

export async function getCalls(options: {
  filter?: CallFilter
  workspaceId?: string
  search?: string
  limit?: number
}) {
  const { filter = 'all', workspaceId, search, limit = 60 } = options

  const conditions = []
  if (workspaceId) conditions.push(eq(call.workspaceId, workspaceId))

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

export type TranscriptTurn = { role: 'agent' | 'caller'; text: string; at: number }

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

  const [events, tools, qa, relatedBooking, relatedLead] = await Promise.all([
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

  return {
    ...row.call,
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    agentName: row.agentName,
    versionNumber: row.versionNumber,
    phoneE164: row.phoneE164,
    transferDestination: row.transferDestination,
    transcript: (row.call.transcript ?? []) as TranscriptTurn[],
    events,
    tools,
    qa: qa[0] ?? null,
    booking: relatedBooking[0] ?? null,
    lead: relatedLead[0] ?? null,
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

  // Flag frequency drives the queue-reason table in Bible §22.
  const flagRows = await db
    .select({ flags: qaResult.flags })
    .from(qaResult)
    .where(sql`${qaResult.reviewerId} is null`)

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

  const passed = runs.filter((r) => r.passed === 'true').length
  const criticalFailed = runs.filter((r) => r.passed === 'false' && r.isCritical === 'true').length

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
  const rows = await db
    .select({
      id: integrationConnection.id,
      provider: integrationConnection.provider,
      label: integrationConnection.label,
      health: integrationConnection.health,
      lastSuccessAt: integrationConnection.lastSuccessAt,
      lastErrorAt: integrationConnection.lastErrorAt,
      errorRate24h: integrationConnection.errorRate24h,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    })
    .from(integrationConnection)
    .innerJoin(workspace, eq(integrationConnection.workspaceId, workspace.id))
    .orderBy(workspace.name)

  const executions = await db
    .select({
      toolName: toolExecution.toolName,
      total: sql<number>`count(*)`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${toolExecution.success} = 'false')`.mapWith(
        Number,
      ),
      p95: sql<number>`coalesce(round(percentile_cont(0.95) within group (order by ${toolExecution.latencyMs})), 0)`.mapWith(
        Number,
      ),
    })
    .from(toolExecution)
    .where(gte(toolExecution.executedAt, daysBack(7)))
    .groupBy(toolExecution.toolName)
    .orderBy(desc(sql`count(*)`))

  return { rows, executions }
}

/* ─── Phone ──────────────────────────────────────────────────────────────── */

export async function getPhoneNumbers() {
  return db
    .select({
      id: phoneNumber.id,
      e164: phoneNumber.e164,
      label: phoneNumber.label,
      mode: phoneNumber.mode,
      sipStatus: phoneNumber.sipStatus,
      transferDestination: phoneNumber.transferDestination,
      lastTestAt: phoneNumber.lastTestAt,
      workspaceName: workspace.name,
      agentName: agent.name,
      calls30d: sql<number>`(
        select count(*) from ${call}
        where ${call.phoneNumberId} = ${phoneNumber.id}
          and ${call.startedAt} >= now() - interval '30 days'
      )`.mapWith(Number),
    })
    .from(phoneNumber)
    .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id))
    .leftJoin(agent, eq(phoneNumber.agentId, agent.id))
    .orderBy(workspace.name)
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

  return { counts: counts ?? null, latency: latency ?? { p50: 0, p95: 0 }, audit }
}

/* ─── Change requests (operator view) ────────────────────────────────────── */

export async function getChangeRequests(workspaceId?: string) {
  return db
    .select({
      id: changeRequest.id,
      type: changeRequest.type,
      title: changeRequest.title,
      description: changeRequest.description,
      status: changeRequest.status,
      createdAt: changeRequest.createdAt,
      updatedAt: changeRequest.updatedAt,
      workspaceName: workspace.name,
    })
    .from(changeRequest)
    .innerJoin(workspace, eq(changeRequest.workspaceId, workspace.id))
    .where(workspaceId ? eq(changeRequest.workspaceId, workspaceId) : undefined)
    .orderBy(desc(changeRequest.createdAt))
}

/* ─── Command palette index ──────────────────────────────────────────────── */

export async function getCommandIndex() {
  const [clients, agents, numbers] = await Promise.all([
    db
      .select({ name: workspace.name, slug: workspace.slug })
      .from(workspace)
      .where(and(eq(workspace.type, 'client'), ne(workspace.status, 'paused'))),
    db
      .select({ name: agent.name, workspaceName: workspace.name })
      .from(agent)
      .innerJoin(workspace, eq(agent.workspaceId, workspace.id)),
    db
      .select({ e164: phoneNumber.e164, workspaceName: workspace.name })
      .from(phoneNumber)
      .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id)),
  ])

  return { clients, agents, numbers }
}
