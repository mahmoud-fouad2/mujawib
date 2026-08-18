'use server'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  changeRequest,
  integrationConnection,
  phoneNumber,
  pronunciation,
  qaResult,
  scenarioRun,
  scenarioTest,
  workspace,
} from '@/server/db/schema'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { message: string } : { message: string; data: T }))
  | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

async function actor() {
  const user = await getCurrentUser()
  return user?.email ?? user?.id ?? 'ops'
}

async function audit(input: {
  workspaceId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  note: string
}) {
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: input.workspaceId ?? null,
    actorId: await actor(),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: { note: input.note },
    createdAt: new Date(),
  })
}

/* ─── QA review ──────────────────────────────────────────────────────────── */

const resolveSchema = z.object({
  qaId: z.string().min(1),
  action: z.enum([
    'pronunciation_fix',
    'knowledge_gap',
    'flow_issue',
    'tool_issue',
    'false_flag',
    'good',
  ]),
  notes: z.string().trim().max(600).optional(),
})

const REVIEW_ACTION_LABEL: Record<string, string> = {
  pronunciation_fix: 'تصحيح نطق',
  knowledge_gap: 'فجوة معرفية',
  flow_issue: 'مشكلة في المسار',
  tool_issue: 'مشكلة في أداة',
  false_flag: 'إنذار خاطئ',
  good: 'مكالمة سليمة',
}

/** Closes a review by recording who looked at it and what they concluded. */
export async function resolveReview(input: z.input<typeof resolveSchema>): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات المراجعة غير مكتملة.' }

  const [row] = await db.select().from(qaResult).where(eq(qaResult.id, parsed.data.qaId)).limit(1)
  if (!row) return { ok: false, error: 'المراجعة غير موجودة.' }
  if (row.reviewerId) return { ok: false, error: 'هذه المراجعة مغلقة بالفعل.' }

  await db
    .update(qaResult)
    .set({
      reviewerId: await actor(),
      action: parsed.data.action,
      notes: parsed.data.notes ?? row.notes,
      updatedAt: new Date(),
    })
    .where(eq(qaResult.id, parsed.data.qaId))

  await audit({
    action: 'qa.review',
    resourceType: 'call',
    resourceId: row.callId,
    note: `إغلاق مراجعة — ${REVIEW_ACTION_LABEL[parsed.data.action]}`,
  })

  revalidatePath('/console/qa')
  revalidatePath('/console')
  revalidatePath('/console/calls')
  return { ok: true, message: `أُغلقت المراجعة — ${REVIEW_ACTION_LABEL[parsed.data.action]}` }
}

/** Puts a closed review back in the queue. */
export async function reopenReview(qaId: string): Promise<ActionResult> {
  const [row] = await db.select().from(qaResult).where(eq(qaResult.id, qaId)).limit(1)
  if (!row) return { ok: false, error: 'المراجعة غير موجودة.' }

  await db
    .update(qaResult)
    .set({ reviewerId: null, action: null, updatedAt: new Date() })
    .where(eq(qaResult.id, qaId))

  await audit({
    action: 'qa.reopen',
    resourceType: 'call',
    resourceId: row.callId,
    note: 'إعادة فتح مراجعة',
  })

  revalidatePath('/console/qa')
  revalidatePath('/console')
  return { ok: true, message: 'أُعيدت المراجعة إلى الطابور.' }
}

/* ─── Agent versions ─────────────────────────────────────────────────────── */

/**
 * Publishing is gated, not decorative — Bible §23. A draft with open blockers,
 * or with a failed critical scenario, cannot go live no matter who clicks.
 */
export async function publishVersion(versionId: string): Promise<ActionResult> {
  const [version] = await db
    .select()
    .from(agentVersion)
    .where(eq(agentVersion.id, versionId))
    .limit(1)
  if (!version) return { ok: false, error: 'النسخة غير موجودة.' }
  if (version.status === 'published') return { ok: false, error: 'هذه النسخة منشورة بالفعل.' }

  const blockers = (version.blockers ?? []) as string[]
  if (blockers.length > 0) {
    return { ok: false, error: `لا يمكن النشر: ${blockers[0]}` }
  }

  const failedCritical = await db
    .select({ name: scenarioTest.name })
    .from(scenarioRun)
    .innerJoin(scenarioTest, eq(scenarioRun.scenarioId, scenarioTest.id))
    .where(
      and(
        eq(scenarioRun.agentVersionId, versionId),
        eq(scenarioRun.passed, 'false'),
        eq(scenarioTest.isCritical, 'true'),
      ),
    )
    .limit(1)

  if (failedCritical.length > 0) {
    return { ok: false, error: `سيناريو حرج لم يمر: ${failedCritical[0]?.name}` }
  }

  const [parent] = await db.select().from(agent).where(eq(agent.id, version.agentId)).limit(1)
  if (!parent) return { ok: false, error: 'الموظف الصوتي غير موجود.' }

  const now = new Date()

  // Retire the version that was live, so exactly one is ever published.
  await db
    .update(agentVersion)
    .set({ status: 'archived', updatedAt: now })
    .where(and(eq(agentVersion.agentId, version.agentId), eq(agentVersion.status, 'published')))

  await db
    .update(agentVersion)
    .set({ status: 'published', publishedAt: now, publishedById: await actor(), updatedAt: now })
    .where(eq(agentVersion.id, versionId))

  await db
    .update(agent)
    .set({ liveVersionId: versionId, updatedAt: now })
    .where(eq(agent.id, version.agentId))

  await audit({
    workspaceId: parent.workspaceId,
    action: 'agent.publish',
    resourceType: 'agent_version',
    resourceId: versionId,
    note: `نشر النسخة v${version.versionNumber} — ${parent.name}`,
  })

  revalidatePath('/console/agents')
  revalidatePath('/console')
  return { ok: true, message: `نُشرت النسخة v${version.versionNumber}.` }
}

/** Returns the agent to its previous published version. */
export async function rollbackAgent(agentId: string): Promise<ActionResult> {
  const [parent] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1)
  if (!parent) return { ok: false, error: 'الموظف الصوتي غير موجود.' }

  const [previous] = await db
    .select()
    .from(agentVersion)
    .where(
      and(
        eq(agentVersion.agentId, agentId),
        eq(agentVersion.status, 'archived'),
        parent.liveVersionId ? ne(agentVersion.id, parent.liveVersionId) : undefined,
      ),
    )
    .orderBy(desc(agentVersion.versionNumber))
    .limit(1)

  if (!previous) return { ok: false, error: 'لا توجد نسخة سابقة يمكن الرجوع إليها.' }

  const now = new Date()

  if (parent.liveVersionId) {
    await db
      .update(agentVersion)
      .set({ status: 'archived', updatedAt: now })
      .where(eq(agentVersion.id, parent.liveVersionId))
  }

  await db
    .update(agentVersion)
    .set({ status: 'published', updatedAt: now })
    .where(eq(agentVersion.id, previous.id))

  await db
    .update(agent)
    .set({ liveVersionId: previous.id, updatedAt: now })
    .where(eq(agent.id, agentId))

  await audit({
    workspaceId: parent.workspaceId,
    action: 'agent.rollback',
    resourceType: 'agent_version',
    resourceId: previous.id,
    note: `الرجوع إلى v${previous.versionNumber} — ${parent.name}`,
  })

  revalidatePath('/console/agents')
  return { ok: true, message: `تم الرجوع إلى v${previous.versionNumber}.` }
}

/* ─── Integrations ───────────────────────────────────────────────────────── */

/**
 * Performs a genuine reachability check when the connection carries a testable
 * endpoint. It does not invent a success for providers that need OAuth we have
 * not completed — those return an explicit "not testable yet" instead.
 */
export async function testIntegration(connectionId: string): Promise<ActionResult> {
  const [row] = await db
    .select()
    .from(integrationConnection)
    .where(eq(integrationConnection.id, connectionId))
    .limit(1)
  if (!row) return { ok: false, error: 'الاتصال غير موجود.' }

  const config = (row.config ?? {}) as { testUrl?: string }
  const now = new Date()

  if (!config.testUrl) {
    await audit({
      workspaceId: row.workspaceId,
      action: 'integration.test_skipped',
      resourceType: 'integration',
      resourceId: row.id,
      note: `تعذر اختبار ${row.label} — لا يوجد عنوان اختبار مضبوط`,
    })
    return {
      ok: false,
      error: `${row.label}: لا يوجد عنوان اختبار مضبوط بعد. يضبطه فريق التشغيل عند إتمام الربط.`,
    }
  }

  const started = Date.now()
  let reachable = false
  let detail = ''

  try {
    const response = await fetch(config.testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    })
    reachable = response.ok
    detail = `HTTP ${response.status}`
  } catch (error) {
    detail = error instanceof Error ? error.message : 'تعذر الاتصال'
  }

  const latency = Date.now() - started

  await db
    .update(integrationConnection)
    .set({
      health: reachable ? 'connected' : 'failed',
      ...(reachable ? { lastSuccessAt: now } : { lastErrorAt: now }),
      updatedAt: now,
    })
    .where(eq(integrationConnection.id, connectionId))

  await audit({
    workspaceId: row.workspaceId,
    action: reachable ? 'integration.test_passed' : 'integration.test_failed',
    resourceType: 'integration',
    resourceId: row.id,
    note: `اختبار ${row.label} — ${detail} (${latency}ms)`,
  })

  revalidatePath('/console/integrations')
  revalidatePath('/console')

  return reachable
    ? { ok: true, message: `${row.label} متصل — ${detail} خلال ${latency}ms.` }
    : { ok: false, error: `${row.label} لم يستجب — ${detail}.` }
}

/* ─── Phone ──────────────────────────────────────────────────────────────── */

/**
 * A route test needs a real inbound call, which Ops places. This files the
 * request and tracks it, rather than stamping "verified" on an untested route.
 */
export async function requestPhoneTest(phoneId: string): Promise<ActionResult> {
  const [row] = await db.select().from(phoneNumber).where(eq(phoneNumber.id, phoneId)).limit(1)
  if (!row) return { ok: false, error: 'الرقم غير موجود.' }

  const now = new Date()

  await db.insert(changeRequest).values({
    id: id('cr'),
    workspaceId: row.workspaceId,
    type: 'phone_test',
    title: `اختبار مسار الرقم ${row.e164}`,
    description: 'طلب مكالمة اختبار للتحقق من المسار قبل التشغيل.',
    status: 'requested',
    requestedById: await actor(),
    metadata: { phoneId: row.id, e164: row.e164 },
    createdAt: now,
    updatedAt: now,
  })

  await audit({
    workspaceId: row.workspaceId,
    action: 'phone.test_requested',
    resourceType: 'phone_number',
    resourceId: row.id,
    note: `طلب اختبار مسار ${row.e164}`,
  })

  revalidatePath('/console/phone')
  return { ok: true, message: `سُجّل طلب اختبار للرقم ${row.e164}.` }
}

const routeSchema = z.object({
  phoneId: z.string().min(1),
  mode: z.enum(['all_calls', 'overflow', 'after_hours']),
  transferDestination: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, 'رقم التحويل غير صحيح'),
})

export async function updatePhoneRoute(input: z.input<typeof routeSchema>): Promise<ActionResult> {
  const parsed = routeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة.' }
  }

  const [row] = await db
    .select()
    .from(phoneNumber)
    .where(eq(phoneNumber.id, parsed.data.phoneId))
    .limit(1)
  if (!row) return { ok: false, error: 'الرقم غير موجود.' }

  await db
    .update(phoneNumber)
    .set({
      mode: parsed.data.mode,
      transferDestination: parsed.data.transferDestination.replaceAll(' ', ''),
      updatedAt: new Date(),
    })
    .where(eq(phoneNumber.id, parsed.data.phoneId))

  await audit({
    workspaceId: row.workspaceId,
    action: 'phone.route_change',
    resourceType: 'phone_number',
    resourceId: row.id,
    note: `تحديث توجيه ${row.e164}`,
  })

  revalidatePath('/console/phone')
  return { ok: true, message: `حُدّث توجيه ${row.e164}.` }
}

/* ─── Pronunciation ──────────────────────────────────────────────────────── */

const pronunciationSchema = z.object({
  workspaceId: z.string().min(1),
  canonical: z.string().trim().min(1, 'الكلمة مطلوبة').max(120),
  arabicDisplay: z.string().trim().max(120).optional(),
  spokenHint: z.string().trim().min(1, 'التلميح الصوتي مطلوب').max(160),
  category: z.enum(['brand', 'person', 'area', 'service', 'medicine']),
})

export async function addPronunciation(
  input: z.input<typeof pronunciationSchema>,
): Promise<ActionResult> {
  const parsed = pronunciationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة.' }
  }

  const now = new Date()
  await db.insert(pronunciation).values({
    id: id('pron'),
    workspaceId: parsed.data.workspaceId,
    canonical: parsed.data.canonical,
    arabicDisplay: parsed.data.arabicDisplay ?? parsed.data.canonical,
    spokenHint: parsed.data.spokenHint,
    category: parsed.data.category,
    scope: 'client',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  })

  await audit({
    workspaceId: parsed.data.workspaceId,
    action: 'voice.pronunciation_added',
    resourceType: 'pronunciation',
    note: `إضافة نطق: ${parsed.data.canonical}`,
  })

  revalidatePath('/console/voice-lab')
  return { ok: true, message: `أُضيف «${parsed.data.canonical}» كمسودة بانتظار الاعتماد.` }
}

export async function setPronunciationStatus(
  pronunciationId: string,
  status: 'approved' | 'rejected' | 'draft',
): Promise<ActionResult> {
  const [row] = await db
    .select()
    .from(pronunciation)
    .where(eq(pronunciation.id, pronunciationId))
    .limit(1)
  if (!row) return { ok: false, error: 'المدخل غير موجود.' }

  await db
    .update(pronunciation)
    .set({ status, updatedAt: new Date() })
    .where(eq(pronunciation.id, pronunciationId))

  const label = status === 'approved' ? 'اعتماد' : status === 'rejected' ? 'رفض' : 'إرجاع لمسودة'
  await audit({
    workspaceId: row.workspaceId,
    action: 'voice.pronunciation_status',
    resourceType: 'pronunciation',
    resourceId: row.id,
    note: `${label} نطق: ${row.canonical}`,
  })

  revalidatePath('/console/voice-lab')
  return { ok: true, message: `تم ${label} «${row.canonical}».` }
}

export async function deletePronunciation(pronunciationId: string): Promise<ActionResult> {
  const [row] = await db
    .select()
    .from(pronunciation)
    .where(eq(pronunciation.id, pronunciationId))
    .limit(1)
  if (!row) return { ok: false, error: 'المدخل غير موجود.' }

  await db.delete(pronunciation).where(eq(pronunciation.id, pronunciationId))

  await audit({
    workspaceId: row.workspaceId,
    action: 'voice.pronunciation_deleted',
    resourceType: 'pronunciation',
    note: `حذف نطق: ${row.canonical}`,
  })

  revalidatePath('/console/voice-lab')
  return { ok: true, message: `حُذف «${row.canonical}».` }
}

/* ─── Clients ────────────────────────────────────────────────────────────── */

const clientSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2, 'اسم الشركة مطلوب').max(160),
  status: z.enum(['discovery', 'setup', 'pilot', 'live', 'paused']),
  city: z.string().trim().max(80).optional(),
  hoursWeekday: z.string().trim().max(40).optional(),
  transferTo: z.string().trim().max(20).optional(),
})

const STATUS_LABEL: Record<string, string> = {
  discovery: 'اكتشاف',
  setup: 'إعداد',
  pilot: 'تجريبي',
  live: 'تشغيل',
  paused: 'موقوف',
}

export async function updateClient(input: z.input<typeof clientSchema>): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة.' }
  }

  const [row] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }

  const info = (row.businessInfo ?? {}) as Record<string, unknown>
  const hours = (info.hours ?? {}) as Record<string, string>

  await db
    .update(workspace)
    .set({
      name: parsed.data.name,
      status: parsed.data.status,
      businessInfo: {
        ...info,
        city: parsed.data.city ?? info.city,
        hours: { ...hours, sun_thu: parsed.data.hoursWeekday ?? hours.sun_thu },
        transferTo: parsed.data.transferTo ?? info.transferTo,
      },
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, parsed.data.workspaceId))

  await audit({
    workspaceId: row.id,
    action: 'client.update',
    resourceType: 'workspace',
    resourceId: row.id,
    note:
      row.status !== parsed.data.status
        ? `تغيير الحالة إلى ${STATUS_LABEL[parsed.data.status]}`
        : 'تحديث بيانات العميل',
  })

  revalidatePath('/console/clients')
  revalidatePath('/console')
  return { ok: true, message: `حُدّثت بيانات ${parsed.data.name}.` }
}

/* ─── Change requests (operator side) ────────────────────────────────────── */

export async function advanceChangeRequest(
  requestId: string,
  status: 'in_review' | 'testing' | 'scheduled' | 'live' | 'rejected',
): Promise<ActionResult> {
  const [row] = await db
    .select()
    .from(changeRequest)
    .where(eq(changeRequest.id, requestId))
    .limit(1)
  if (!row) return { ok: false, error: 'الطلب غير موجود.' }

  await db
    .update(changeRequest)
    .set({ status, assignedToId: await actor(), updatedAt: new Date() })
    .where(eq(changeRequest.id, requestId))

  const label: Record<string, string> = {
    in_review: 'قيد المراجعة',
    testing: 'اختبار',
    scheduled: 'مجدول',
    live: 'تم التنفيذ',
    rejected: 'مرفوض',
  }

  await audit({
    workspaceId: row.workspaceId,
    action: 'change_request.advance',
    resourceType: 'change_request',
    resourceId: row.id,
    note: `${row.title} → ${label[status]}`,
  })

  revalidatePath('/console/clients')
  revalidatePath('/portal/requests')
  return { ok: true, message: `الطلب الآن: ${label[status]}.` }
}
