import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import {
  type CampaignStatus,
  canAttempt,
  DEFAULT_CALLING_WINDOW,
  DISPATCH_REASON_LABEL,
  dispatchDecision,
  isWithinCallingWindow,
  localParts,
  MAX_ATTEMPTS_PER_CONTACT,
} from '@/lib/campaigns'
import { withinGlobalDemoCap } from '@/lib/demo-call'
import { db } from '@/server/db'
import {
  campaignAttempt,
  campaignContact,
  demoCallRequest,
  outboundCampaign,
  phoneNumber,
  suppressionEntry,
} from '@/server/db/schema'
import { outboundDialerStatus, placeOutboundCall } from '@/server/outbound/dialer'
import { isDraining } from '@/server/runtime/lifecycle'
import { readVitals } from '@/server/runtime/vitals'
import { maskNumber, voiceError, voiceLog } from '@/server/voice/log'

/**
 * The outbound dispatcher.
 *
 * Runs from the same maintenance tick as every other background sweep, which
 * is the whole reason it is safe on this deployment: no second process, no
 * queue, no Redis, and a lease already exists so two containers cannot both
 * dial the same list.
 *
 * Its job is to say no. Six independent gates have to agree before one number
 * is dialled — the dialer is configured, the campaign is running, the process
 * is neither draining nor under memory pressure, the local clock is inside the
 * calling window, the campaign has concurrency and daily budget left, and the
 * individual contact is not suppressed, exhausted, or too recently called.
 *
 * The gates are re-evaluated per contact rather than once per campaign. A
 * number can be suppressed after its row was queued, and a queue decision made
 * thirty seconds ago must not be what dials a phone now.
 */

/** A `calling` row older than this lost its process; nothing will close it. */
const STALE_CALLING_MINUTES = 15

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

/** Start of the campaign's own local day, for the daily cap. */
function localDayStart(now: Date, utcOffsetMinutes: number): Date {
  const { minute } = localParts(now, utcOffsetMinutes)
  return new Date(now.getTime() - minute * 60_000)
}

type RunningCampaign = {
  id: string
  workspaceId: string
  status: CampaignStatus
  startedAt: Date | null
  windowStartMinute: number
  windowEndMinute: number
  windowDays: number[]
  utcOffsetMinutes: number
  initialConcurrency: number
  maxConcurrency: number
  rampMinutes: number
  dailyCap: number
  fromNumberId: string | null
}

async function noteDispatch(campaignId: string, reason: string) {
  await db
    .update(outboundCampaign)
    .set({ lastDispatchReason: reason, lastDispatchAt: new Date() })
    .where(eq(outboundCampaign.id, campaignId))
}

/**
 * Releases contacts whose call was placed by a process that no longer exists.
 *
 * Without this a container replaced mid-dial leaves rows stuck on `calling`
 * forever: they hold a concurrency slot that is never freed, so the campaign
 * quietly stops making progress and nothing says why.
 */
async function releaseStaleCalling(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_CALLING_MINUTES * 60_000)
  const released = await db
    .update(campaignContact)
    .set({
      // Not `failed`: the call may well have connected and been held by a
      // process we lost. What is missing is our record, not necessarily the
      // conversation — the same distinction `reconcileStaleCalls` makes.
      status: sql`case when ${campaignContact.attempts} >= ${MAX_ATTEMPTS_PER_CONTACT} then 'failed' else 'pending' end`,
      lastError: 'انقطع تتبع المكالمة قبل اكتمالها',
      updatedAt: new Date(),
    })
    .where(and(eq(campaignContact.status, 'calling'), lt(campaignContact.lastAttemptAt, cutoff)))
    .returning({ id: campaignContact.id })
  return released.length
}

/** Closes campaigns with nothing left that could ever be dialled. */
async function completeFinishedCampaigns(): Promise<number> {
  const finished = await db
    .update(outboundCampaign)
    .set({ status: 'completed', completedAt: new Date(), lastDispatchReason: 'no_contacts' })
    .where(
      and(
        eq(outboundCampaign.status, 'running'),
        sql`not exists (
          select 1 from ${campaignContact}
          where ${campaignContact.campaignId} = ${outboundCampaign.id}
            and ${campaignContact.status} in ('pending','queued','calling')
        )`,
      ),
    )
    .returning({ id: outboundCampaign.id })
  return finished.length
}

/**
 * One pass over every running campaign.
 *
 * Returns a summary rather than logging only, so the maintenance tick can
 * decide whether the pass is worth a line at all — a dispatcher that logs
 * every fifteen seconds on a deployment with no campaigns is noise that hides
 * the lines that matter.
 */
export async function runCampaignDispatch(): Promise<{
  campaigns: number
  placed: number
  refused: number
  released: number
  completed: number
  demo: number
}> {
  const summary = { campaigns: 0, placed: 0, refused: 0, released: 0, completed: 0, demo: 0 }

  // A draining process is finishing the calls it already holds. Starting new
  // outbound legs during a deploy hands them to a container about to exit.
  if (isDraining()) return summary

  const dialer = outboundDialerStatus()

  summary.released = await releaseStaleCalling()
  summary.completed = await completeFinishedCampaigns()
  // Ahead of the campaign sweep and independent of it: somebody waiting on a
  // demo call they just asked for is watching a page, and a campaign is not.
  summary.demo = await dispatchDemoCalls(dialer.ready)

  const campaigns = (await db
    .select({
      id: outboundCampaign.id,
      workspaceId: outboundCampaign.workspaceId,
      status: outboundCampaign.status,
      startedAt: outboundCampaign.startedAt,
      windowStartMinute: outboundCampaign.windowStartMinute,
      windowEndMinute: outboundCampaign.windowEndMinute,
      windowDays: outboundCampaign.windowDays,
      utcOffsetMinutes: outboundCampaign.utcOffsetMinutes,
      initialConcurrency: outboundCampaign.initialConcurrency,
      maxConcurrency: outboundCampaign.maxConcurrency,
      rampMinutes: outboundCampaign.rampMinutes,
      dailyCap: outboundCampaign.dailyCap,
      fromNumberId: outboundCampaign.fromNumberId,
    })
    .from(outboundCampaign)
    .where(eq(outboundCampaign.status, 'running'))
    .orderBy(asc(outboundCampaign.updatedAt))
    .limit(10)) as RunningCampaign[]

  if (campaigns.length === 0) {
    if (summary.demo > 0) voiceLog('CAMPAIGN_DISPATCH', summary)
    return summary
  }
  summary.campaigns = campaigns.length

  // Outbound is the most interruptible work this process does. Under memory
  // pressure the calls already on the line come first, and a campaign that
  // waits fifteen seconds loses nothing.
  const vitals = readVitals({ reset: false })
  if (vitals.pressure !== 'ok') {
    for (const campaign of campaigns) await noteDispatch(campaign.id, 'memory_pressure')
    return summary
  }

  for (const campaign of campaigns) {
    const placed = await dispatchOne(campaign, dialer.ready)
    summary.placed += placed.placed
    summary.refused += placed.refused
  }

  if (summary.placed > 0 || summary.released > 0 || summary.completed > 0 || summary.demo > 0) {
    voiceLog('CAMPAIGN_DISPATCH', summary)
  }
  return summary
}

async function dispatchOne(
  campaign: RunningCampaign,
  dialerReady: boolean,
): Promise<{ placed: number; refused: number }> {
  const now = new Date()

  const [counts] = await db
    .select({
      inFlight: sql<number>`count(*) filter (where ${campaignContact.status} in ('queued','calling'))::int`,
      remaining: sql<number>`count(*) filter (where ${campaignContact.status} = 'pending')::int`,
    })
    .from(campaignContact)
    .where(eq(campaignContact.campaignId, campaign.id))

  const dayStart = localDayStart(now, campaign.utcOffsetMinutes)
  const [today] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(campaignAttempt)
    .where(
      and(
        eq(campaignAttempt.workspaceId, campaign.workspaceId),
        eq(campaignAttempt.placed, true),
        sql`${campaignAttempt.createdAt} >= ${dayStart}`,
      ),
    )

  const decision = dispatchDecision({
    status: campaign.status,
    now,
    startedAt: campaign.startedAt,
    window: {
      startMinute: campaign.windowStartMinute,
      endMinute: campaign.windowEndMinute,
      activeDays: campaign.windowDays,
      utcOffsetMinutes: campaign.utcOffsetMinutes,
    },
    pacing: {
      initialConcurrency: campaign.initialConcurrency,
      maxConcurrency: campaign.maxConcurrency,
      rampMinutes: campaign.rampMinutes,
    },
    inFlight: Number(counts?.inFlight ?? 0),
    remainingContacts: Number(counts?.remaining ?? 0),
    callsPlacedToday: Number(today?.total ?? 0),
    dailyCap: campaign.dailyCap,
    dialerReady,
  })

  await noteDispatch(campaign.id, decision.reason)
  if (decision.allowed <= 0) return { placed: 0, refused: 0 }

  const fromNumber = campaign.fromNumberId
    ? await db
        .select({ e164: phoneNumber.e164 })
        .from(phoneNumber)
        .where(eq(phoneNumber.id, campaign.fromNumberId))
        .limit(1)
        .then((rows) => rows[0]?.e164 ?? null)
    : null
  if (!fromNumber) {
    await noteDispatch(campaign.id, 'no_from_number')
    return { placed: 0, refused: 0 }
  }

  /**
   * Claim rows before doing anything slow with them.
   *
   * `for update skip locked` is what makes this safe if two ticks ever
   * overlap: the second one sees a smaller set rather than the same rows.
   */
  const claimed = await db.execute<{ id: string; phone: string; attempts: number }>(sql`
    update ${campaignContact}
    set status = 'queued', updated_at = now()
    where id in (
      select id from ${campaignContact}
      where ${campaignContact.campaignId} = ${campaign.id}
        and ${campaignContact.status} = 'pending'
      order by ${campaignContact.createdAt}
      limit ${decision.allowed}
      for update skip locked
    )
    returning id, phone, attempts
  `)

  const rows = Array.from(claimed as Iterable<{ id: string; phone: string; attempts: number }>)
  if (rows.length === 0) return { placed: 0, refused: 0 }

  // One suppression read for the whole batch, immediately before dialling —
  // not at import time, and not once per campaign. Through the query builder
  // so the numbers are bound parameters, never interpolated text.
  const suppressedRows = await db
    .select({ phone: suppressionEntry.phone })
    .from(suppressionEntry)
    .where(
      and(
        eq(suppressionEntry.workspaceId, campaign.workspaceId),
        inArray(
          suppressionEntry.phone,
          rows.map((r) => r.phone),
        ),
      ),
    )
  const suppressed = new Set(suppressedRows.map((r) => r.phone))

  let placed = 0
  let refused = 0

  for (const row of rows) {
    const [current] = await db
      .select({
        status: campaignContact.status,
        attempts: campaignContact.attempts,
        lastAttemptAt: campaignContact.lastAttemptAt,
      })
      .from(campaignContact)
      .where(eq(campaignContact.id, row.id))
      .limit(1)
    if (!current) continue

    const eligible = canAttempt({
      status: 'pending',
      attempts: current.attempts,
      lastAttemptAt: current.lastAttemptAt,
      now: new Date(),
      suppressed: suppressed.has(row.phone),
    })

    if (!eligible.ok) {
      refused += 1
      await db
        .update(campaignContact)
        .set({
          status: eligible.reason === 'suppressed' ? 'suppressed' : 'pending',
          lastError: eligible.reason,
          updatedAt: new Date(),
        })
        .where(eq(campaignContact.id, row.id))
      await db.insert(campaignAttempt).values({
        id: id('att'),
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        maskedPhone: maskNumber(row.phone),
        contactId: row.id,
        placed: false,
        outcome: eligible.reason,
        createdAt: new Date(),
      })
      continue
    }

    const attemptId = id('att')
    await db
      .update(campaignContact)
      .set({
        status: 'calling',
        attempts: current.attempts + 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignContact.id, row.id))

    const result = await placeOutboundCall({
      to: row.phone,
      from: fromNumber,
      // Twilio dedupes on this, so a retried tick cannot double-dial.
      reference: attemptId,
    })

    await db.insert(campaignAttempt).values({
      id: attemptId,
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      maskedPhone: maskNumber(row.phone),
      contactId: row.id,
      placed: result.ok,
      outcome: result.ok ? 'placed' : null,
      error: result.ok ? null : result.error,
      createdAt: new Date(),
    })

    if (result.ok) {
      placed += 1
    } else {
      refused += 1
      await db
        .update(campaignContact)
        .set({
          // Retryable failures go back in the queue and consume an attempt;
          // a permanent one stops here rather than burning all three.
          status:
            result.retryable && current.attempts + 1 < MAX_ATTEMPTS_PER_CONTACT
              ? 'pending'
              : 'failed',
          lastError: result.error.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(campaignContact.id, row.id))
      voiceError('CAMPAIGN_DIAL_FAILED', {
        campaignId: campaign.id,
        to: maskNumber(row.phone),
        error: result.error,
      })
    }
  }

  return { placed, refused }
}

/** Reason text for a console row, resolved from the stored machine value. */
export function dispatchReasonLabel(reason: string | null): string | null {
  if (!reason) return null
  if (reason === 'memory_pressure') return 'الخادم تحت ضغط ذاكرة — أُجّلت المكالمات'
  if (reason === 'no_from_number') return 'لا يوجد رقم صادر مربوط'
  return DISPATCH_REASON_LABEL[reason as keyof typeof DISPATCH_REASON_LABEL] ?? reason
}

/** Closes a contact when its call actually ends. Called from the voice path. */
export async function settleCampaignContactForCall(input: {
  callId: string
  workspaceId: string
  /** Masked or full; only the last four digits are used to match. */
  calledNumber: string | null
  outcome: 'completed' | 'no_answer' | 'busy' | 'failed'
  summary?: string
}): Promise<{ linked: number; reason: 'ok' | 'no_number' | 'no_match' | 'ambiguous' }> {
  const digits = (input.calledNumber ?? '').replace(/[^0-9]/g, '')
  if (digits.length < 4) return { linked: 0, reason: 'no_number' }
  const tail = digits.slice(-4)

  const candidates = await db
    .select({ id: campaignContact.id })
    .from(campaignContact)
    .where(
      and(
        eq(campaignContact.workspaceId, input.workspaceId),
        eq(campaignContact.status, 'calling'),
        // The stored number is full E.164; the call row's is masked at write
        // time, so the last four digits are the only part present on both.
        sql`right(${campaignContact.phone}, 4) = ${tail}`,
      ),
    )
    .limit(2)

  // Exactly one, or nothing. Ambiguity is left alone deliberately: a summary
  // filed against the wrong person is worse than a record with no summary,
  // because one of the two is wrong and nothing on the screen says so.
  if (candidates.length !== 1) {
    return { linked: 0, reason: candidates.length === 0 ? 'no_match' : 'ambiguous' }
  }
  const contact = candidates[0]
  if (!contact) return { linked: 0, reason: 'no_match' }

  await db
    .update(campaignContact)
    .set({
      status: input.outcome,
      outcome: input.outcome,
      ...(input.summary ? { summary: input.summary.slice(0, 2000) } : {}),
      lastCallId: input.callId,
      updatedAt: new Date(),
    })
    .where(and(eq(campaignContact.id, contact.id), eq(campaignContact.status, 'calling')))

  await db
    .update(campaignAttempt)
    .set({ callId: input.callId, outcome: input.outcome })
    .where(and(eq(campaignAttempt.contactId, contact.id), isNull(campaignAttempt.callId)))

  return { linked: 1, reason: 'ok' }
}

/* ─── the public demo ────────────────────────────────────────────────────── */

/**
 * Places calls for demo requests whose number has been verified.
 *
 * Runs from the same tick as the campaign dispatcher, and refuses on the same
 * grounds — draining, memory pressure, an unconfigured dialer — plus three of
 * its own:
 *
 * The request must carry `verifiedAt`. Status alone is not enough: a status
 * can be edited from the console, and what makes a call permissible here is
 * that somebody read a code sent to that number.
 *
 * A demo assistant and a caller id must be designated (`DEMO_AGENT_VERSION_ID`
 * and `DEMO_FROM_NUMBER_ID`). Unset — the default — verified requests simply
 * wait for an operator, which is the behaviour before this existed.
 *
 * And the whole platform has a daily ceiling. If verification, rate limiting
 * and the blocklist all fail at once, this is what stops the bill.
 */
async function dispatchDemoCalls(dialerReady: boolean): Promise<number> {
  if (!dialerReady) return 0

  const agentVersionId = process.env.DEMO_AGENT_VERSION_ID?.trim()
  const fromNumberId = process.env.DEMO_FROM_NUMBER_ID?.trim()
  if (!agentVersionId || !fromNumberId) return 0

  const cap = Number(process.env.DEMO_DAILY_CALL_CAP ?? 50)
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const [today] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(demoCallRequest)
    .where(
      and(
        inArray(demoCallRequest.status, ['calling', 'completed', 'failed']),
        sql`${demoCallRequest.updatedAt} >= ${dayStart}`,
      ),
    )
  if (!withinGlobalDemoCap(Number(today?.total ?? 0), cap)) return 0

  const [from] = await db
    .select({ e164: phoneNumber.e164 })
    .from(phoneNumber)
    .where(eq(phoneNumber.id, fromNumberId))
    .limit(1)
  if (!from) return 0

  // Demo calls run inside the same decent hours a campaign does. Somebody who
  // asked at 2am asked to be called, not to be woken.
  const now = new Date()
  if (!isWithinCallingWindow(now, DEFAULT_CALLING_WINDOW)) return 0

  // One per tick. The demo is a courtesy, not a queue to drain, and a single
  // call every fifteen seconds is faster than anybody waiting for one notices.
  const claimed = await db
    .update(demoCallRequest)
    .set({ status: 'calling', updatedAt: now })
    .where(
      and(
        eq(demoCallRequest.status, 'verified'),
        isNotNull(demoCallRequest.verifiedAt),
        eq(
          demoCallRequest.id,
          sql`(select id from ${demoCallRequest}
               where status = 'verified' and verified_at is not null
               order by verified_at
               limit 1 for update skip locked)`,
        ),
      ),
    )
    .returning({ id: demoCallRequest.id, phone: demoCallRequest.phone })

  const request = claimed[0]
  if (!request) return 0

  const result = await placeOutboundCall({
    to: request.phone,
    from: from.e164,
    reference: `${request.id}-auto`,
  })

  await db
    .update(demoCallRequest)
    .set({
      status: result.ok ? 'completed' : 'failed',
      attempts: sql`${demoCallRequest.attempts} + 1`,
      lastError: result.ok ? null : result.error.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(eq(demoCallRequest.id, request.id))

  if (!result.ok) {
    voiceError('DEMO_CALL_FAILED', { to: maskNumber(request.phone), error: result.error })
    return 0
  }
  return 1
}
