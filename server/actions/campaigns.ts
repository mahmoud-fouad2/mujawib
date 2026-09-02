'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  CAMPAIGN_PURPOSES,
  CONSENT_BASES,
  campaignReadiness,
  clampCallingWindow,
  importContacts,
  isReadyToSubmit,
  MAX_CALLS_PER_DAY,
  MAX_CONCURRENT_CALLS,
  MAX_CONTACTS_PER_CAMPAIGN,
} from '@/lib/campaigns'
import { normalizePhoneE164 } from '@/lib/voice-normalization'
import { limitAction } from '@/server/actions/guard'
import { authorizeClientWorkspace, authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  campaignContact,
  outboundCampaign,
  phoneNumber,
  suppressionEntry,
} from '@/server/db/schema'
import { outboundDialerStatus } from '@/server/outbound/dialer'
import { maskNumber } from '@/server/voice/log'

/**
 * Writes for outbound campaigns.
 *
 * Two separate authorities, and the split is the whole design:
 *
 * A **client** may build a campaign — name it, upload a list, choose an agent
 * and a number, write the script, set the hours — and submit it. That is all.
 * Nothing a client does can cause a phone to ring.
 *
 * An **operator** approves, and only an approved campaign can run. `running`
 * is unreachable from every client-side path in this file.
 *
 * Every action here is a POST endpoint whose id ships in the client bundle, so
 * the authority check is in the action, never in whether a button rendered.
 */

export type CampaignResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

async function audit(input: {
  workspaceId: string | null
  actorId: string
  action: string
  resourceId: string
  note: string
}) {
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    resourceType: 'outbound_campaign',
    resourceId: input.resourceId,
    metadata: { note: input.note },
    createdAt: new Date(),
  })
}

function refresh(campaignId?: string) {
  revalidatePath('/portal/campaigns')
  revalidatePath('/console/campaigns')
  if (campaignId) {
    revalidatePath(`/portal/campaigns/${campaignId}`)
    revalidatePath(`/console/campaigns/${campaignId}`)
  }
}

/* ─── client-side authoring ──────────────────────────────────────────────── */

const saveSchema = z.object({
  id: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1),
  name: z.string().trim().min(3, 'اسم الحملة قصير جدًا.').max(120),
  purpose: z.enum(CAMPAIGN_PURPOSES),
  consentBasis: z.enum(CONSENT_BASES),
  consentNote: z.string().trim().max(600).optional(),
  agentVersionId: z.string().trim().min(1, 'اختر الموظف الصوتي.'),
  fromNumberId: z.string().trim().min(1, 'اختر رقم الاتصال.'),
  script: z.string().trim().min(40, 'تعليمات المكالمة قصيرة جدًا.').max(4000),
  forbiddenClaims: z.string().trim().max(2000).optional(),
  windowStartMinute: z.number().int().min(0).max(1439),
  windowEndMinute: z.number().int().min(0).max(1440),
  windowDays: z.array(z.number().int().min(0).max(6)).max(7),
  utcOffsetMinutes: z.number().int().min(-720).max(840),
  initialConcurrency: z.number().int().min(1).max(MAX_CONCURRENT_CALLS),
  maxConcurrency: z.number().int().min(1).max(MAX_CONCURRENT_CALLS),
  rampMinutes: z.number().int().min(1).max(120),
  dailyCap: z.number().int().min(1).max(MAX_CALLS_PER_DAY),
})

/**
 * Only a campaign that has not been approved may be edited.
 *
 * Editing an approved campaign would let a reviewed script be swapped for an
 * unreviewed one after the fact, which would make the approval meaningless.
 * Changing an approved campaign means withdrawing it first.
 */
const EDITABLE_STATUSES = ['draft', 'pending_review', 'rejected'] as const

export async function saveCampaign(
  input: z.input<typeof saveSchema>,
): Promise<CampaignResult<{ id: string }>> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة.' }
  }
  const data = parsed.data
  const access = await authorizeClientWorkspace(data.workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }

  // The agent and the number must belong to this workspace. Without this the
  // id fields are an open door onto another client's published agent.
  const [version] = await db
    .select({ id: agentVersion.id })
    .from(agentVersion)
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(and(eq(agentVersion.id, data.agentVersionId), eq(agent.workspaceId, data.workspaceId)))
    .limit(1)
  if (!version) return { ok: false, error: 'الموظف الصوتي غير متاح لهذا النشاط.' }

  const [number] = await db
    .select({ id: phoneNumber.id })
    .from(phoneNumber)
    .where(
      and(eq(phoneNumber.id, data.fromNumberId), eq(phoneNumber.workspaceId, data.workspaceId)),
    )
    .limit(1)
  if (!number) return { ok: false, error: 'الرقم غير مربوط بهذا النشاط.' }

  const window = clampCallingWindow({
    startMinute: data.windowStartMinute,
    endMinute: data.windowEndMinute,
    activeDays: data.windowDays,
    utcOffsetMinutes: data.utcOffsetMinutes,
  })
  const maxConcurrency = Math.min(data.maxConcurrency, MAX_CONCURRENT_CALLS)

  const values = {
    workspaceId: data.workspaceId,
    name: data.name,
    purpose: data.purpose,
    consentBasis: data.consentBasis,
    consentNote: data.consentNote ?? null,
    agentVersionId: data.agentVersionId,
    fromNumberId: data.fromNumberId,
    script: data.script,
    forbiddenClaims: data.forbiddenClaims ?? null,
    windowStartMinute: window.startMinute,
    windowEndMinute: window.endMinute,
    windowDays: window.activeDays,
    utcOffsetMinutes: window.utcOffsetMinutes,
    initialConcurrency: Math.min(data.initialConcurrency, maxConcurrency),
    maxConcurrency,
    rampMinutes: data.rampMinutes,
    dailyCap: Math.min(data.dailyCap, MAX_CALLS_PER_DAY),
    updatedAt: new Date(),
  }

  if (data.id) {
    const [existing] = await db
      .select({ status: outboundCampaign.status })
      .from(outboundCampaign)
      .where(
        and(eq(outboundCampaign.id, data.id), eq(outboundCampaign.workspaceId, data.workspaceId)),
      )
      .limit(1)
    if (!existing) return { ok: false, error: 'الحملة غير موجودة.' }
    if (!(EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
      return { ok: false, error: 'لا يمكن تعديل حملة معتمدة أو قيد التشغيل. اسحبها للمسودة أولًا.' }
    }
    await db.update(outboundCampaign).set(values).where(eq(outboundCampaign.id, data.id))
    await audit({
      workspaceId: data.workspaceId,
      actorId: access.userId,
      action: 'campaign.update',
      resourceId: data.id,
      note: data.name,
    })
    refresh(data.id)
    return { ok: true, message: 'حُفظت الحملة.', data: { id: data.id } }
  }

  const campaignId = id('camp')
  await db.insert(outboundCampaign).values({
    id: campaignId,
    ...values,
    status: 'draft',
    createdById: access.userId,
    createdAt: new Date(),
  })
  await audit({
    workspaceId: data.workspaceId,
    actorId: access.userId,
    action: 'campaign.create',
    resourceId: campaignId,
    note: data.name,
  })
  refresh(campaignId)
  return { ok: true, message: 'أُنشئت الحملة كمسودة.', data: { id: campaignId } }
}

/* ─── contact import ─────────────────────────────────────────────────────── */

const importSchema = z.object({
  campaignId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  /** Raw CSV text. Read in the browser so no file ever hits the server disk. */
  csv: z.string().max(2_000_000),
})

export type ImportSummary = {
  inserted: number
  duplicatesInFile: number
  alreadyPresent: number
  suppressed: number
  rejected: { line: number; raw: string; reason: string }[]
}

/**
 * Parses an uploaded list and stores what survived, with a full account of
 * what did not.
 *
 * Suppressed numbers are inserted as `suppressed` rather than skipped. A
 * client who uploads four hundred rows and sees three hundred and eighty must
 * be able to find out that twenty were on their own do-not-call list —
 * otherwise the natural conclusion is that the upload is broken, and the next
 * step is to upload again.
 */
export async function importCampaignContacts(
  input: z.input<typeof importSchema>,
): Promise<CampaignResult<ImportSummary>> {
  const parsed = importSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ملف غير صالح.' }
  const { campaignId, workspaceId, csv } = parsed.data

  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }
  const limited = limitAction('campaign_import', access.userId)
  if (limited) return limited

  const [campaign] = await db
    .select({ status: outboundCampaign.status })
    .from(outboundCampaign)
    .where(and(eq(outboundCampaign.id, campaignId), eq(outboundCampaign.workspaceId, workspaceId)))
    .limit(1)
  if (!campaign) return { ok: false, error: 'الحملة غير موجودة.' }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(campaign.status)) {
    return { ok: false, error: 'لا يمكن تعديل القائمة بعد الاعتماد.' }
  }

  const [{ existing = 0 } = {}] = await db
    .select({ existing: sql<number>`count(*)::int` })
    .from(campaignContact)
    .where(eq(campaignContact.campaignId, campaignId))

  const room = Math.max(0, MAX_CONTACTS_PER_CAMPAIGN - Number(existing))
  if (room === 0) {
    return { ok: false, error: `بلغت الحملة الحد الأقصى (${MAX_CONTACTS_PER_CAMPAIGN} جهة).` }
  }

  const result = importContacts(csv, room)
  if (result.contacts.length === 0) {
    return {
      ok: false,
      error:
        result.issues.length > 0
          ? 'لم يُقبل أي صف. تأكد أن الملف يحتوي عمود أرقام صالحة.'
          : 'الملف فارغ.',
    }
  }

  const phones = result.contacts.map((c) => c.phone)
  const suppressedRows = await db
    .select({ phone: suppressionEntry.phone })
    .from(suppressionEntry)
    .where(
      and(eq(suppressionEntry.workspaceId, workspaceId), inArray(suppressionEntry.phone, phones)),
    )
  const suppressed = new Set(suppressedRows.map((row) => row.phone))

  const now = new Date()
  const rows = result.contacts.map((contact) => ({
    id: id('cc'),
    campaignId,
    workspaceId,
    phone: contact.phone,
    name: contact.name,
    note: contact.note,
    fields: contact.fields,
    status: suppressed.has(contact.phone) ? ('suppressed' as const) : ('pending' as const),
    createdAt: now,
    updatedAt: now,
  }))

  // Chunked: one 5,000-row statement can exceed the parameter limit, and a
  // partial insert that reports success is worse than a slower one.
  let inserted = 0
  for (let at = 0; at < rows.length; at += 500) {
    const slice = rows.slice(at, at + 500)
    const written = await db
      .insert(campaignContact)
      .values(slice)
      .onConflictDoNothing({
        target: [campaignContact.campaignId, campaignContact.phone],
      })
      .returning({ id: campaignContact.id })
    inserted += written.length
  }

  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.import',
    resourceId: campaignId,
    note: `${inserted} جهة من ${result.totalRows} صف`,
  })
  refresh(campaignId)

  return {
    ok: true,
    message: `أُضيفت ${inserted} جهة.`,
    data: {
      inserted,
      duplicatesInFile: result.issues.filter((i) => i.reason === 'duplicate_in_file').length,
      alreadyPresent: result.contacts.length - inserted,
      suppressed: suppressed.size,
      rejected: result.issues.slice(0, 50).map((i) => ({
        line: i.line,
        raw: i.raw,
        reason: i.reason,
      })),
    },
  }
}

export async function clearCampaignContacts(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignResult> {
  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }

  const [campaign] = await db
    .select({ status: outboundCampaign.status })
    .from(outboundCampaign)
    .where(and(eq(outboundCampaign.id, campaignId), eq(outboundCampaign.workspaceId, workspaceId)))
    .limit(1)
  if (!campaign) return { ok: false, error: 'الحملة غير موجودة.' }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(campaign.status)) {
    return { ok: false, error: 'لا يمكن مسح القائمة بعد الاعتماد.' }
  }

  await db.delete(campaignContact).where(eq(campaignContact.campaignId, campaignId))
  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.contacts.clear',
    resourceId: campaignId,
    note: 'مسح القائمة',
  })
  refresh(campaignId)
  return { ok: true, message: 'مُسحت القائمة.' }
}

/* ─── submission ─────────────────────────────────────────────────────────── */

/**
 * Hands a campaign to an operator for review.
 *
 * Re-runs the readiness check on the server. The client already ran it to
 * decide whether to enable a button, and that is a convenience, not a gate.
 */
export async function submitCampaignForReview(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignResult> {
  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }

  const [campaign] = await db
    .select()
    .from(outboundCampaign)
    .where(and(eq(outboundCampaign.id, campaignId), eq(outboundCampaign.workspaceId, workspaceId)))
    .limit(1)
  if (!campaign) return { ok: false, error: 'الحملة غير موجودة.' }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(campaign.status)) {
    return { ok: false, error: 'الحملة مُرسلة بالفعل.' }
  }

  const [{ total = 0 } = {}] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(campaignContact)
    .where(and(eq(campaignContact.campaignId, campaignId), eq(campaignContact.status, 'pending')))

  const problems = campaignReadiness({
    name: campaign.name,
    purpose: campaign.purpose,
    consentBasis: campaign.consentBasis,
    agentVersionId: campaign.agentVersionId,
    fromNumberId: campaign.fromNumberId,
    contactCount: Number(total),
    script: campaign.script,
    forbiddenClaims: campaign.forbiddenClaims,
    // Readiness is about the campaign, not the server: a campaign can be
    // reviewed and approved on a deployment that cannot yet dial. What the
    // dialer decides is whether it may *run*, and that is checked in
    // `startCampaign` and again on every dispatch tick.
    dialerReady: true,
  })
  if (!isReadyToSubmit(problems)) {
    const blocking = problems.find((p) => p.blocking)
    return { ok: false, error: blocking?.message ?? 'الحملة غير مكتملة.' }
  }

  await db
    .update(outboundCampaign)
    .set({ status: 'pending_review', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(outboundCampaign.id, campaignId))
  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.submit',
    resourceId: campaignId,
    note: `${total} جهة`,
  })
  refresh(campaignId)
  return { ok: true, message: 'أُرسلت الحملة للمراجعة.' }
}

export async function withdrawCampaign(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignResult> {
  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }

  const [updated] = await db
    .update(outboundCampaign)
    .set({
      status: 'draft',
      submittedAt: null,
      approvedAt: null,
      approvedById: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outboundCampaign.id, campaignId),
        eq(outboundCampaign.workspaceId, workspaceId),
        // A running campaign is stopped, not withdrawn.
        inArray(outboundCampaign.status, ['pending_review', 'approved', 'rejected']),
      ),
    )
    .returning({ id: outboundCampaign.id })
  if (!updated) return { ok: false, error: 'لا يمكن سحب هذه الحملة في حالتها الحالية.' }

  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.withdraw',
    resourceId: campaignId,
    note: 'سحب للمسودة',
  })
  refresh(campaignId)
  return { ok: true, message: 'عادت الحملة إلى المسودة.' }
}

/* ─── operator review ────────────────────────────────────────────────────── */

export async function reviewCampaign(
  campaignId: string,
  decision: 'approve' | 'reject',
  note: string,
): Promise<CampaignResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية اعتماد الحملات.' }

  const [campaign] = await db
    .select({ workspaceId: outboundCampaign.workspaceId, status: outboundCampaign.status })
    .from(outboundCampaign)
    .where(eq(outboundCampaign.id, campaignId))
    .limit(1)
  if (!campaign) return { ok: false, error: 'الحملة غير موجودة.' }
  if (campaign.status !== 'pending_review') {
    return { ok: false, error: 'هذه الحملة ليست بانتظار المراجعة.' }
  }
  const trimmed = note.trim().slice(0, 600)
  if (decision === 'reject' && trimmed.length < 5) {
    return { ok: false, error: 'اكتب سبب الرفض حتى يعرف العميل ما يصلحه.' }
  }

  await db
    .update(outboundCampaign)
    .set({
      status: decision === 'approve' ? 'approved' : 'rejected',
      approvedAt: decision === 'approve' ? new Date() : null,
      approvedById: decision === 'approve' ? access.userId : null,
      reviewNote: trimmed || null,
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaign.id, campaignId))

  await audit({
    workspaceId: campaign.workspaceId,
    actorId: access.userId,
    action: decision === 'approve' ? 'campaign.approve' : 'campaign.reject',
    resourceId: campaignId,
    note: trimmed || decision,
  })
  refresh(campaignId)
  return { ok: true, message: decision === 'approve' ? 'اعتُمدت الحملة.' : 'رُفضت الحملة.' }
}

/* ─── run control ────────────────────────────────────────────────────────── */

/**
 * The only path from `approved` to `running`, and the only place a phone can
 * start ringing.
 *
 * Operator-only on purpose. A client builds and submits; the decision to
 * actually dial a list of real people stays with the platform.
 */
export async function startCampaign(campaignId: string): Promise<CampaignResult> {
  const access = await authorizeOperator('campaign.approve')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية تشغيل الحملات.' }
  const limited = limitAction('campaign_control', access.userId)
  if (limited) return limited

  const dialer = outboundDialerStatus()
  if (!dialer.ready) {
    return {
      ok: false,
      error: `الاتصال الصادر غير مُهيّأ على هذا الخادم. الناقص: ${dialer.missing.join('، ')}`,
    }
  }

  const [campaign] = await db
    .select({ workspaceId: outboundCampaign.workspaceId, status: outboundCampaign.status })
    .from(outboundCampaign)
    .where(eq(outboundCampaign.id, campaignId))
    .limit(1)
  if (!campaign) return { ok: false, error: 'الحملة غير موجودة.' }
  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    return { ok: false, error: 'لا يمكن تشغيل الحملة إلا بعد اعتمادها.' }
  }

  await db
    .update(outboundCampaign)
    .set({
      status: 'running',
      // Set once: the pacing ramp measures from the first real start, so a
      // pause and resume must not reset the campaign to one call at a time.
      startedAt: sql`coalesce(${outboundCampaign.startedAt}, now())`,
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaign.id, campaignId))

  await audit({
    workspaceId: campaign.workspaceId,
    actorId: access.userId,
    action: 'campaign.start',
    resourceId: campaignId,
    note: 'بدء التشغيل',
  })
  refresh(campaignId)
  return { ok: true, message: 'بدأت الحملة.' }
}

/**
 * Pause and stop are available to the client as well as the operator.
 *
 * Stopping something that is calling your own customers must never wait on
 * somebody else being awake. Starting is restricted; stopping is not.
 */
export async function setCampaignRunState(
  campaignId: string,
  workspaceId: string,
  next: 'paused' | 'stopped',
): Promise<CampaignResult> {
  const client = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  const operator = client ? null : await authorizeOperator('campaign.approve')
  const actorId = client?.userId ?? operator?.userId
  if (!actorId) return { ok: false, error: 'ليس لديك صلاحية إيقاف الحملات.' }

  const [updated] = await db
    .update(outboundCampaign)
    .set({
      status: next,
      ...(next === 'stopped' ? { completedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outboundCampaign.id, campaignId),
        eq(outboundCampaign.workspaceId, workspaceId),
        inArray(outboundCampaign.status, ['running', 'paused', 'approved']),
      ),
    )
    .returning({ id: outboundCampaign.id })
  if (!updated) return { ok: false, error: 'لا يمكن إيقاف هذه الحملة في حالتها الحالية.' }

  // Queued rows are released so a resumed campaign re-evaluates every gate
  // rather than dialling from a decision made before the pause.
  await db
    .update(campaignContact)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(and(eq(campaignContact.campaignId, campaignId), eq(campaignContact.status, 'queued')))

  await audit({
    workspaceId,
    actorId,
    action: next === 'paused' ? 'campaign.pause' : 'campaign.stop',
    resourceId: campaignId,
    note: next,
  })
  refresh(campaignId)
  return { ok: true, message: next === 'paused' ? 'أُوقفت مؤقتًا.' : 'أُوقفت الحملة.' }
}

/** Puts one failed contact back in the queue, without touching the rest. */
export async function retryCampaignContact(
  contactId: string,
  workspaceId: string,
): Promise<CampaignResult> {
  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة الحملات.' }

  const [contact] = await db
    .select({ campaignId: campaignContact.campaignId, phone: campaignContact.phone })
    .from(campaignContact)
    .where(and(eq(campaignContact.id, contactId), eq(campaignContact.workspaceId, workspaceId)))
    .limit(1)
  if (!contact) return { ok: false, error: 'الجهة غير موجودة.' }

  // A suppressed number is never retried, whatever the button says.
  const [blocked] = await db
    .select({ id: suppressionEntry.id })
    .from(suppressionEntry)
    .where(
      and(eq(suppressionEntry.workspaceId, workspaceId), eq(suppressionEntry.phone, contact.phone)),
    )
    .limit(1)
  if (blocked) return { ok: false, error: 'هذا الرقم في قائمة الحظر.' }

  const [updated] = await db
    .update(campaignContact)
    .set({ status: 'pending', attempts: 0, lastError: null, updatedAt: new Date() })
    .where(
      and(
        eq(campaignContact.id, contactId),
        inArray(campaignContact.status, ['no_answer', 'busy', 'failed']),
      ),
    )
    .returning({ id: campaignContact.id })
  if (!updated) return { ok: false, error: 'لا يمكن إعادة المحاولة لهذه الحالة.' }

  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.contact.retry',
    resourceId: contact.campaignId,
    note: maskNumber(contact.phone),
  })
  refresh(contact.campaignId)
  return { ok: true, message: 'أُعيدت الجهة إلى الطابور.' }
}

/* ─── suppression list ───────────────────────────────────────────────────── */

const suppressSchema = z.object({
  workspaceId: z.string().trim().min(1),
  phone: z.string().trim().min(5).max(40),
  reason: z.string().trim().max(300).optional(),
})

/**
 * Adds a number to the workspace's do-not-call list, and cancels it wherever
 * it is currently queued.
 *
 * The second half is the point. Adding a number to a list that only new
 * imports consult would leave it queued in three running campaigns.
 */
export async function suppressNumber(
  input: z.input<typeof suppressSchema>,
): Promise<CampaignResult> {
  const parsed = suppressSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'رقم غير صالح.' }
  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة قائمة الحظر.' }

  const phone = normalizePhoneE164(parsed.data.phone)
  if (!phone) return { ok: false, error: 'رقم غير صالح. اكتبه بصيغة دولية.' }

  await db
    .insert(suppressionEntry)
    .values({
      id: id('supp'),
      workspaceId: parsed.data.workspaceId,
      phone,
      source: 'manual',
      reason: parsed.data.reason ?? null,
      createdById: access.userId,
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [suppressionEntry.workspaceId, suppressionEntry.phone],
    })

  const cancelled = await db
    .update(campaignContact)
    .set({ status: 'suppressed', updatedAt: new Date() })
    .where(
      and(
        eq(campaignContact.workspaceId, parsed.data.workspaceId),
        eq(campaignContact.phone, phone),
        inArray(campaignContact.status, ['pending', 'queued']),
      ),
    )
    .returning({ id: campaignContact.id })

  await audit({
    workspaceId: parsed.data.workspaceId,
    actorId: access.userId,
    action: 'campaign.suppress',
    resourceId: phone,
    note: `${maskNumber(phone)} — أُلغيت ${cancelled.length} جهة مجدولة`,
  })
  revalidatePath('/portal/campaigns')
  return {
    ok: true,
    message:
      cancelled.length > 0
        ? `أُضيف الرقم لقائمة الحظر وأُلغيت ${cancelled.length} جهة مجدولة.`
        : 'أُضيف الرقم لقائمة الحظر.',
  }
}

export async function unsuppressNumber(
  entryId: string,
  workspaceId: string,
): Promise<CampaignResult> {
  const access = await authorizeClientWorkspace(workspaceId, 'campaign.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إدارة قائمة الحظر.' }

  const [removed] = await db
    .delete(suppressionEntry)
    .where(and(eq(suppressionEntry.id, entryId), eq(suppressionEntry.workspaceId, workspaceId)))
    .returning({ phone: suppressionEntry.phone })
  if (!removed) return { ok: false, error: 'غير موجود.' }

  await audit({
    workspaceId,
    actorId: access.userId,
    action: 'campaign.unsuppress',
    resourceId: removed.phone,
    note: maskNumber(removed.phone),
  })
  revalidatePath('/portal/campaigns')
  return { ok: true, message: 'أُزيل الرقم من قائمة الحظر.' }
}
