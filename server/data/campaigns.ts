import 'server-only'

import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type {
  CallingWindow,
  CampaignContactStatus,
  CampaignPurpose,
  CampaignStatus,
  ConsentBasis,
  PacingConfig,
} from '@/lib/campaigns'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  campaignAttempt,
  campaignContact,
  outboundCampaign,
  phoneNumber,
  suppressionEntry,
  workspace,
} from '@/server/db/schema'

/**
 * Reads for outbound campaigns.
 *
 * Nothing here is cached. A campaign screen is read by the person deciding
 * whether to let it keep calling people, and a thirty-second-stale count of
 * how many have been dialled is worse than a fresh query costs.
 *
 * Every list is bounded. The audit that produced `0024_operational_indexes`
 * found unbounded console tables; this module does not add more.
 */

const LIST_LIMIT = 100
const CONTACT_PAGE = 200

export type CampaignRow = {
  id: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  name: string
  purpose: CampaignPurpose | null
  consentBasis: ConsentBasis | null
  status: CampaignStatus
  contactCount: number
  doneCount: number
  startedAt: Date | null
  submittedAt: Date | null
  approvedAt: Date | null
  lastDispatchReason: string | null
  lastDispatchAt: Date | null
  createdAt: Date
}

/** Counts joined in SQL — one query per list, not one per row. */
const contactCounts = db
  .select({
    campaignId: campaignContact.campaignId,
    total: count().as('total'),
    done: sql<number>`count(*) filter (where ${campaignContact.status} not in ('pending','queued','calling'))`.as(
      'done',
    ),
  })
  .from(campaignContact)
  .groupBy(campaignContact.campaignId)
  .as('contact_counts')

function campaignSelection() {
  return db
    .select({
      id: outboundCampaign.id,
      workspaceId: outboundCampaign.workspaceId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      name: outboundCampaign.name,
      purpose: outboundCampaign.purpose,
      consentBasis: outboundCampaign.consentBasis,
      status: outboundCampaign.status,
      contactCount: sql<number>`coalesce(${contactCounts.total}, 0)`,
      doneCount: sql<number>`coalesce(${contactCounts.done}, 0)`,
      startedAt: outboundCampaign.startedAt,
      submittedAt: outboundCampaign.submittedAt,
      approvedAt: outboundCampaign.approvedAt,
      lastDispatchReason: outboundCampaign.lastDispatchReason,
      lastDispatchAt: outboundCampaign.lastDispatchAt,
      createdAt: outboundCampaign.createdAt,
    })
    .from(outboundCampaign)
    .innerJoin(workspace, eq(outboundCampaign.workspaceId, workspace.id))
    .leftJoin(contactCounts, eq(contactCounts.campaignId, outboundCampaign.id))
}

export type CampaignListFilter = {
  status?: CampaignStatus
  workspaceId?: string
}

/** Every workspace's campaigns — console only. */
export async function getCampaignsForConsole(filter: CampaignListFilter = {}) {
  const conditions = [
    filter.status ? eq(outboundCampaign.status, filter.status) : undefined,
    filter.workspaceId ? eq(outboundCampaign.workspaceId, filter.workspaceId) : undefined,
  ].filter(Boolean)

  const rows = await campaignSelection()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(outboundCampaign.createdAt))
    .limit(LIST_LIMIT)
  return rows as CampaignRow[]
}

/** One workspace's campaigns — portal. */
export async function getCampaignsForWorkspace(workspaceId: string) {
  const rows = await campaignSelection()
    .where(eq(outboundCampaign.workspaceId, workspaceId))
    .orderBy(desc(outboundCampaign.createdAt))
    .limit(LIST_LIMIT)
  return rows as CampaignRow[]
}

export type CampaignDetail = CampaignRow & {
  consentNote: string | null
  agentVersionId: string | null
  agentName: string | null
  agentVersionNumber: number | null
  fromNumberId: string | null
  fromNumberE164: string | null
  script: string | null
  forbiddenClaims: string | null
  window: CallingWindow
  pacing: PacingConfig
  dailyCap: number
  reviewNote: string | null
  completedAt: Date | null
}

export async function getCampaignDetail(
  campaignId: string,
  workspaceId?: string,
): Promise<CampaignDetail | null> {
  const [row] = await db
    .select({
      id: outboundCampaign.id,
      workspaceId: outboundCampaign.workspaceId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      name: outboundCampaign.name,
      purpose: outboundCampaign.purpose,
      consentBasis: outboundCampaign.consentBasis,
      consentNote: outboundCampaign.consentNote,
      status: outboundCampaign.status,
      agentVersionId: outboundCampaign.agentVersionId,
      agentName: agent.name,
      agentVersionNumber: agentVersion.versionNumber,
      fromNumberId: outboundCampaign.fromNumberId,
      fromNumberE164: phoneNumber.e164,
      script: outboundCampaign.script,
      forbiddenClaims: outboundCampaign.forbiddenClaims,
      windowStartMinute: outboundCampaign.windowStartMinute,
      windowEndMinute: outboundCampaign.windowEndMinute,
      windowDays: outboundCampaign.windowDays,
      utcOffsetMinutes: outboundCampaign.utcOffsetMinutes,
      initialConcurrency: outboundCampaign.initialConcurrency,
      maxConcurrency: outboundCampaign.maxConcurrency,
      rampMinutes: outboundCampaign.rampMinutes,
      dailyCap: outboundCampaign.dailyCap,
      startedAt: outboundCampaign.startedAt,
      completedAt: outboundCampaign.completedAt,
      submittedAt: outboundCampaign.submittedAt,
      approvedAt: outboundCampaign.approvedAt,
      reviewNote: outboundCampaign.reviewNote,
      lastDispatchReason: outboundCampaign.lastDispatchReason,
      lastDispatchAt: outboundCampaign.lastDispatchAt,
      createdAt: outboundCampaign.createdAt,
    })
    .from(outboundCampaign)
    .innerJoin(workspace, eq(outboundCampaign.workspaceId, workspace.id))
    .leftJoin(agentVersion, eq(outboundCampaign.agentVersionId, agentVersion.id))
    .leftJoin(agent, eq(agentVersion.agentId, agent.id))
    .leftJoin(phoneNumber, eq(outboundCampaign.fromNumberId, phoneNumber.id))
    .where(
      workspaceId
        ? and(eq(outboundCampaign.id, campaignId), eq(outboundCampaign.workspaceId, workspaceId))
        : eq(outboundCampaign.id, campaignId),
    )
    .limit(1)

  if (!row) return null

  const [counts] = await db
    .select({
      total: count(),
      done: sql<number>`count(*) filter (where ${campaignContact.status} not in ('pending','queued','calling'))`,
    })
    .from(campaignContact)
    .where(eq(campaignContact.campaignId, campaignId))

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    name: row.name,
    purpose: row.purpose,
    consentBasis: row.consentBasis,
    consentNote: row.consentNote,
    status: row.status,
    agentVersionId: row.agentVersionId,
    agentName: row.agentName,
    agentVersionNumber: row.agentVersionNumber,
    fromNumberId: row.fromNumberId,
    fromNumberE164: row.fromNumberE164,
    script: row.script,
    forbiddenClaims: row.forbiddenClaims,
    window: {
      startMinute: row.windowStartMinute,
      endMinute: row.windowEndMinute,
      activeDays: row.windowDays,
      utcOffsetMinutes: row.utcOffsetMinutes,
    },
    pacing: {
      initialConcurrency: row.initialConcurrency,
      maxConcurrency: row.maxConcurrency,
      rampMinutes: row.rampMinutes,
    },
    dailyCap: row.dailyCap,
    contactCount: Number(counts?.total ?? 0),
    doneCount: Number(counts?.done ?? 0),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    reviewNote: row.reviewNote,
    lastDispatchReason: row.lastDispatchReason,
    lastDispatchAt: row.lastDispatchAt,
    createdAt: row.createdAt,
  }
}

export type ContactRow = {
  id: string
  phone: string
  name: string | null
  note: string | null
  status: CampaignContactStatus
  attempts: number
  lastAttemptAt: Date | null
  lastError: string | null
  outcome: string | null
  summary: string | null
  lastCallId: string | null
}

export async function getCampaignContacts(
  campaignId: string,
  filter: { status?: CampaignContactStatus } = {},
): Promise<ContactRow[]> {
  const rows = await db
    .select({
      id: campaignContact.id,
      phone: campaignContact.phone,
      name: campaignContact.name,
      note: campaignContact.note,
      status: campaignContact.status,
      attempts: campaignContact.attempts,
      lastAttemptAt: campaignContact.lastAttemptAt,
      lastError: campaignContact.lastError,
      outcome: campaignContact.outcome,
      summary: campaignContact.summary,
      lastCallId: campaignContact.lastCallId,
    })
    .from(campaignContact)
    .where(
      filter.status
        ? and(eq(campaignContact.campaignId, campaignId), eq(campaignContact.status, filter.status))
        : eq(campaignContact.campaignId, campaignId),
    )
    .orderBy(campaignContact.createdAt)
    .limit(CONTACT_PAGE)
  return rows as ContactRow[]
}

/** One pass over the whole list, for the progress strip. */
export async function getContactStatusCounts(campaignId: string) {
  const rows = await db
    .select({ status: campaignContact.status, total: count() })
    .from(campaignContact)
    .where(eq(campaignContact.campaignId, campaignId))
    .groupBy(campaignContact.status)
  return rows.map((row) => ({
    status: row.status as CampaignContactStatus,
    total: Number(row.total),
  }))
}

export type SuppressionRow = {
  id: string
  phone: string
  source: string
  reason: string | null
  createdAt: Date
}

export async function getSuppressionList(workspaceId: string): Promise<SuppressionRow[]> {
  const rows = await db
    .select({
      id: suppressionEntry.id,
      phone: suppressionEntry.phone,
      source: suppressionEntry.source,
      reason: suppressionEntry.reason,
      createdAt: suppressionEntry.createdAt,
    })
    .from(suppressionEntry)
    .where(eq(suppressionEntry.workspaceId, workspaceId))
    .orderBy(desc(suppressionEntry.createdAt))
    .limit(LIST_LIMIT)
  return rows
}

/** Which of these numbers are on the workspace's do-not-call list. */
export async function suppressedNumbers(
  workspaceId: string,
  phones: string[],
): Promise<Set<string>> {
  if (phones.length === 0) return new Set()
  const rows = await db
    .select({ phone: suppressionEntry.phone })
    .from(suppressionEntry)
    .where(
      and(eq(suppressionEntry.workspaceId, workspaceId), inArray(suppressionEntry.phone, phones)),
    )
  return new Set(rows.map((row) => row.phone))
}

/** Outbound calls this workspace has placed since local midnight-ish. */
export async function callsPlacedToday(workspaceId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(campaignAttempt)
    .where(
      and(
        eq(campaignAttempt.workspaceId, workspaceId),
        eq(campaignAttempt.placed, true),
        gte(campaignAttempt.createdAt, since),
      ),
    )
  return Number(row?.total ?? 0)
}

export type AttemptRow = {
  id: string
  maskedPhone: string
  placed: boolean
  outcome: string | null
  error: string | null
  createdAt: Date
  callId: string | null
}

export async function getCampaignAttempts(campaignId: string): Promise<AttemptRow[]> {
  return db
    .select({
      id: campaignAttempt.id,
      maskedPhone: campaignAttempt.maskedPhone,
      placed: campaignAttempt.placed,
      outcome: campaignAttempt.outcome,
      error: campaignAttempt.error,
      createdAt: campaignAttempt.createdAt,
      callId: campaignAttempt.callId,
    })
    .from(campaignAttempt)
    .where(eq(campaignAttempt.campaignId, campaignId))
    .orderBy(desc(campaignAttempt.createdAt))
    .limit(50)
}

/** Published agent versions and live numbers a campaign may be pointed at. */
export async function getCampaignTargets(workspaceId: string) {
  const [versions, numbers] = await Promise.all([
    db
      .select({
        id: agentVersion.id,
        versionNumber: agentVersion.versionNumber,
        agentName: agent.name,
      })
      .from(agentVersion)
      .innerJoin(agent, eq(agentVersion.agentId, agent.id))
      .where(and(eq(agent.workspaceId, workspaceId), eq(agentVersion.status, 'published')))
      .orderBy(desc(agentVersion.versionNumber))
      .limit(50),
    db
      .select({ id: phoneNumber.id, e164: phoneNumber.e164, label: phoneNumber.label })
      .from(phoneNumber)
      .where(eq(phoneNumber.workspaceId, workspaceId))
      .orderBy(phoneNumber.e164)
      .limit(50),
  ])
  return { versions, numbers }
}
