import 'server-only'

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { dialectLabel } from '@/lib/voice-personas'
import { db } from '@/server/db'
import {
  booking,
  call,
  callEvent,
  industryTemplate,
  integrationConnection,
  qaResult,
  toolExecution,
  voiceProfile,
  workspace,
} from '@/server/db/schema'

/**
 * The marketing site quotes the platform, not a copywriter. Every figure and
 * the hero transcript come from the same database the console reads, so the
 * site cannot claim something the product does not do.
 */

function daysBack(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function liveCutoff() {
  return new Date(Date.now() - 2 * 60 * 60 * 1000)
}

export type PlatformProof = {
  callsHandled: number
  bookings: number
  resolvedRate: number
  afterHours: number
  medianResponseMs: number
  clients: number
}

async function loadPlatformProof(): Promise<PlatformProof> {
  const since = daysBack(30)

  const [calls] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      resolved:
        sql<number>`count(*) filter (where ${call.outcome} in ('resolved','booking','lead'))`.mapWith(
          Number,
        ),
      closed: sql<number>`count(*) filter (where ${call.outcome} is not null)`.mapWith(Number),
      afterHours:
        sql<number>`count(*) filter (where (${call.metadata} ->> 'afterHours') = 'true')`.mapWith(
          Number,
        ),
    })
    .from(call)
    .where(and(gte(call.startedAt, since), eq(call.origin, 'live')))

  const [bookings] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(booking)
    .innerJoin(call, eq(booking.callId, call.id))
    .where(and(gte(booking.createdAt, since), eq(call.origin, 'live')))

  const [latency] = await db
    .select({
      p50: sql<number>`coalesce(round(percentile_cont(0.5) within group (order by ${callEvent.latencyMs})), 0)`.mapWith(
        Number,
      ),
    })
    .from(callEvent)
    .innerJoin(call, eq(callEvent.callId, call.id))
    .where(
      and(
        eq(callEvent.type, 'agent_turn'),
        gte(callEvent.occurredAt, since),
        eq(call.origin, 'live'),
      ),
    )

  const [clients] = await db
    .select({ n: sql<number>`count(distinct ${call.workspaceId})`.mapWith(Number) })
    .from(call)
    .where(and(gte(call.startedAt, since), eq(call.origin, 'live')))

  const closed = calls?.closed ?? 0

  return {
    callsHandled: calls?.total ?? 0,
    bookings: bookings?.n ?? 0,
    resolvedRate: closed > 0 ? Math.round(((calls?.resolved ?? 0) / closed) * 100) : 0,
    afterHours: calls?.afterHours ?? 0,
    medianResponseMs: latency?.p50 ?? 0,
    clients: clients?.n ?? 0,
  }
}

type HeroTurn = { role: 'agent' | 'caller'; text: string; at: number }

export type HeroCall = {
  id: string
  workspaceName: string
  intent: string | null
  durationSeconds: number | null
  turns: HeroTurn[]
  tools: { name: string; success: boolean; latencyMs: number | null }[]
  booking: { service: string | null; scheduledAt: Date | null; customerName: string | null } | null
}

/**
 * A real completed booking call, used as the hero. Picked deterministically
 * (most recent qualifying call) so the page is stable between renders.
 */
async function loadHeroCall(): Promise<HeroCall | null> {
  const [row] = await db
    .select({
      id: call.id,
      workspaceName: workspace.name,
      intent: call.intent,
      durationSeconds: call.durationSeconds,
      transcript: call.transcript,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .where(
      and(eq(call.outcome, 'booking'), eq(call.origin, 'seed'), eq(workspace.slug, 'alfa-clinic')),
    )
    .orderBy(desc(call.startedAt))
    .limit(1)

  if (!row) return null

  const [tools, bookings] = await Promise.all([
    db
      .select({
        name: toolExecution.toolName,
        status: toolExecution.status,
        latencyMs: toolExecution.latencyMs,
      })
      .from(toolExecution)
      .where(eq(toolExecution.callId, row.id))
      .orderBy(toolExecution.executedAt),
    db
      .select({
        service: booking.service,
        scheduledAt: booking.scheduledAt,
        customerName: booking.customerName,
      })
      .from(booking)
      .where(eq(booking.callId, row.id))
      .limit(1),
  ])

  return {
    id: row.id,
    workspaceName: row.workspaceName,
    intent: row.intent,
    durationSeconds: row.durationSeconds,
    turns: (row.transcript ?? []) as HeroTurn[],
    tools: tools.map((t) => ({
      name: t.name,
      success: t.status === 'succeeded',
      latencyMs: t.latencyMs,
    })),
    booking: bookings[0] ?? null,
  }
}

/** Three short demo calls in different dialects — Bible §38 "Live Demo". */
async function loadDemoCalls() {
  const rows = await db
    .select({
      id: call.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      intent: call.intent,
      outcome: call.outcome,
      durationSeconds: call.durationSeconds,
      transcript: call.transcript,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .where(
      and(
        eq(call.status, 'completed'),
        eq(call.origin, 'seed'),
        sql`${call.outcome} in ('booking','resolved','lead')`,
      ),
    )
    .orderBy(desc(call.startedAt))
    .limit(60)

  // One representative call per client, so the demos are visibly different.
  const bySlug = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!bySlug.has(r.workspaceSlug)) bySlug.set(r.workspaceSlug, r)

  return [...bySlug.values()].slice(0, 3).map((r) => ({
    ...r,
    turns: (r.transcript ?? []) as HeroTurn[],
  }))
}

/** Industry packs, with the number of businesses actually running each. */
async function loadIndustryPacks() {
  const templates = await db.select().from(industryTemplate)
  const usage = await db
    .select({
      pack: workspace.industryPack,
      n: sql<number>`count(distinct ${workspace.id})`.mapWith(Number),
    })
    .from(workspace)
    .innerJoin(call, and(eq(call.workspaceId, workspace.id), eq(call.origin, 'live')))
    .where(eq(workspace.type, 'client'))
    .groupBy(workspace.industryPack)

  const usageBy = new Map(usage.map((u) => [u.pack, u.n]))
  return templates.map((t) => ({ ...t, clients: usageBy.get(t.packKey) ?? 0 }))
}

/** Integrations that are genuinely connected somewhere on the platform. */
async function loadLiveIntegrations() {
  const rows = await db
    .select({
      provider: integrationConnection.provider,
      label: integrationConnection.label,
      connected:
        sql<number>`count(*) filter (where ${integrationConnection.health} = 'connected')`.mapWith(
          Number,
        ),
    })
    .from(integrationConnection)
    .groupBy(integrationConnection.provider, integrationConnection.label)
    .orderBy(desc(sql`count(*)`))

  return rows
}

/**
 * A slice of the operator console for the landing page. The hero already shows
 * one call in full, so this section shows the surface that *ranks* calls —
 * otherwise the page states the same thing twice.
 */
async function loadConsolePreview() {
  const [queue, liveRows, reviewRows, degradedRows] = await Promise.all([
    db
      .select({
        id: call.id,
        workspaceName: workspace.name,
        intent: call.intent,
        outcome: call.outcome,
        durationSeconds: call.durationSeconds,
        flags: qaResult.flags,
      })
      .from(qaResult)
      .innerJoin(call, eq(qaResult.callId, call.id))
      .innerJoin(workspace, eq(call.workspaceId, workspace.id))
      .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live')))
      .orderBy(desc(qaResult.createdAt))
      .limit(4),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(call)
      .where(
        and(
          sql`${call.status} in ('live','ringing','waiting_tool')`,
          eq(call.origin, 'live'),
          gte(call.startedAt, liveCutoff()),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(qaResult)
      .innerJoin(call, eq(qaResult.callId, call.id))
      .where(and(sql`${qaResult.reviewerId} is null`, eq(call.origin, 'live'))),
    db
      .select({ n: sql<number>`count(distinct ${integrationConnection.id})`.mapWith(Number) })
      .from(integrationConnection)
      .innerJoin(
        call,
        and(eq(call.workspaceId, integrationConnection.workspaceId), eq(call.origin, 'live')),
      )
      .where(inArray(integrationConnection.health, ['degraded', 'failed'])),
  ])

  return {
    queue: queue.map((q) => ({ ...q, flags: (q.flags ?? []) as string[] })),
    counts: {
      live: liveRows[0]?.n ?? 0,
      review: reviewRows[0]?.n ?? 0,
      degraded: degradedRows[0]?.n ?? 0,
    },
  }
}

/* ─── caching boundary ─────────────────────────────────────────────────────
 *
 * Every function above reads the same database the console does, and the
 * public marketing pages call six of them on each render — roughly fifteen
 * queries per visit, on the pool the operator console shares. Nothing cached
 * them: React's `cache()` deduplicates within a single request, not across
 * requests, so every crawler hit and every visitor paid the full cost, and a
 * traffic spike on the public site could starve the console.
 *
 * These figures describe the last thirty days. They do not need to be fresh
 * to the second, and a five-minute window turns thousands of visits into one
 * set of queries. `revalidate` is what makes this a real cross-request cache
 * rather than a per-request one; the tag lets an operator action drop it
 * deliberately if a figure ever needs to move sooner.
 */
const MARKETING_TTL_SECONDS = 300
export const MARKETING_CACHE_TAG = 'marketing-figures'

function cachedMarketing<T>(key: string, loader: () => Promise<T>) {
  return unstable_cache(loader, ['marketing', key], {
    revalidate: MARKETING_TTL_SECONDS,
    tags: [MARKETING_CACHE_TAG],
  })
}

export const getPlatformProof = cachedMarketing('platform-proof', loadPlatformProof)
export const getHeroCall = cachedMarketing('hero-call', loadHeroCall)
export const getDemoCalls = cachedMarketing('demo-calls', loadDemoCalls)
export const getIndustryPacks = cachedMarketing('industry-packs', loadIndustryPacks)
export const getLiveIntegrations = cachedMarketing('live-integrations', loadLiveIntegrations)
export const getConsolePreview = cachedMarketing('console-preview', loadConsolePreview)

export type DemoPersona = {
  key: string
  name: string
  dialectLabel: string
  gender: 'male' | 'female'
}

/**
 * The voices a visitor may ask to hear on the demo call.
 *
 * Read from the database, like every other figure on this site, so a persona
 * an operator has renamed or retired is not still being offered by a constant
 * compiled into the page.
 */
async function loadDemoPersonas(): Promise<DemoPersona[]> {
  const rows = await db
    .select({
      personaKey: voiceProfile.personaKey,
      name: voiceProfile.name,
      dialect: voiceProfile.dialect,
      gender: voiceProfile.gender,
    })
    .from(voiceProfile)
    .where(and(eq(voiceProfile.isGlobal, true), eq(voiceProfile.language, 'ar')))
    .orderBy(voiceProfile.sortOrder)
    .limit(12)

  return rows.flatMap((row) =>
    row.personaKey
      ? [
          {
            key: row.personaKey,
            name: row.name,
            dialectLabel: dialectLabel(row.dialect),
            gender: (row.gender ?? 'female') as 'male' | 'female',
          },
        ]
      : [],
  )
}

export const getDemoPersonas = cachedMarketing('demo-personas', loadDemoPersonas)
