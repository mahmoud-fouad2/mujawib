'use server'

import { randomUUID } from 'crypto'
import { and, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { OperatorPermission } from '@/lib/access'
import {
  capabilitiesForProvider,
  credentialReference,
  type IntegrationAction,
  inspectOutboundUrl,
} from '@/lib/integrations'
import { authorizeOperator } from '@/server/auth/access'
import { getCurrentUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  changeRequest,
  flow,
  integrationConnection,
  phoneNumber,
  pronunciation,
  qaResult,
  salesInquiry,
  scenarioTest,
  workspace,
} from '@/server/db/schema'
import { invokeIntegration } from '@/server/integrations/runtime'
import { getClientReadinessById } from '@/server/operations/client-readiness'
import { getVersionTestGate } from '@/server/test-lab/gate'
import { markPhoneActive, markPhoneDisabled } from '@/server/voice/phone'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { message: string } : { message: string; data: T }))
  | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

async function actor() {
  const user = await getCurrentUser()
  return user?.id ?? 'ops'
}

async function requireActionPermission(
  permission: OperatorPermission,
): Promise<{ ok: false; error: string } | null> {
  const access = await authorizeOperator(permission)
  return access ? null : { ok: false, error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' }
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

const inquiryStatusSchema = z.object({
  inquiryId: z.string().min(1),
  status: z.enum(['new', 'qualified', 'proposal', 'won', 'lost']),
})

export async function updateSalesInquiryStatus(
  input: z.input<typeof inquiryStatusSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied
  const parsed = inquiryStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'حالة الطلب غير صحيحة.' }

  const [row] = await db
    .select()
    .from(salesInquiry)
    .where(eq(salesInquiry.id, parsed.data.inquiryId))
    .limit(1)
  if (!row) return { ok: false, error: 'طلب العرض غير موجود.' }

  const actorId = await actor()
  await db.transaction(async (tx) => {
    await tx
      .update(salesInquiry)
      .set({ status: parsed.data.status, ownerId: actorId, updatedAt: new Date() })
      .where(eq(salesInquiry.id, row.id))
    await tx.insert(auditLog).values({
      id: id('audit'),
      actorId,
      action: 'sales_inquiry.status_changed',
      resourceType: 'sales_inquiry',
      resourceId: row.id,
      metadata: { from: row.status, to: parsed.data.status, company: row.company },
      createdAt: new Date(),
    })
  })

  revalidatePath('/console/inquiries')
  return { ok: true, message: 'حُدّثت حالة طلب العرض.' }
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
  const denied = await requireActionPermission('qa.review')
  if (denied) return denied
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
  const denied = await requireActionPermission('qa.review')
  if (denied) return denied
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
 * Publishing is gated, not decorative — Bible §23. Every configured scenario
 * must have a trusted run after the version's latest edit, and critical
 * scenarios must pass.
 */
export async function publishVersion(versionId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied
  const [version] = await db
    .select()
    .from(agentVersion)
    .where(eq(agentVersion.id, versionId))
    .limit(1)
  if (!version) return { ok: false, error: 'النسخة غير موجودة.' }
  if (version.status === 'published') return { ok: false, error: 'هذه النسخة منشورة بالفعل.' }

  const testGate = await getVersionTestGate(versionId)
  if (!testGate?.canPublish) {
    return {
      ok: false,
      error: `لا يمكن النشر: ${testGate?.blockers[0] ?? 'تعذّر التحقق من نتائج الاختبار.'}`,
    }
  }

  const [parent] = await db.select().from(agent).where(eq(agent.id, version.agentId)).limit(1)
  if (!parent) return { ok: false, error: 'الموظف الصوتي غير موجود.' }

  const now = new Date()
  const publishedById = await actor()

  try {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: agent.id })
        .from(agent)
        .where(eq(agent.id, version.agentId))
        .for('update')
      await tx
        .update(agentVersion)
        .set({ status: 'archived', updatedAt: now })
        .where(and(eq(agentVersion.agentId, version.agentId), eq(agentVersion.status, 'published')))
      await tx
        .update(agentVersion)
        .set({ status: 'published', publishedAt: now, publishedById, updatedAt: now })
        .where(eq(agentVersion.id, versionId))
      await tx
        .update(agent)
        .set({ liveVersionId: versionId, updatedAt: now })
        .where(eq(agent.id, version.agentId))
      await tx.insert(auditLog).values({
        id: id('audit'),
        workspaceId: parent.workspaceId,
        actorId: publishedById,
        action: 'agent.publish',
        resourceType: 'agent_version',
        resourceId: versionId,
        metadata: { note: `نشر النسخة v${version.versionNumber} — ${parent.name}` },
        createdAt: now,
      })
    })
  } catch {
    return { ok: false, error: 'تعذر إتمام النشر بصورة ذرية. لم تتغير النسخة الحية.' }
  }

  revalidatePath('/console/agents')
  revalidatePath('/console/test-lab')
  revalidatePath('/console')
  return { ok: true, message: `نُشرت النسخة v${version.versionNumber}.` }
}

/** Creates the next editable version without mutating the published runtime. */
export async function createAgentDraft(
  agentId: string,
): Promise<ActionResult<{ versionId: string }>> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied

  const now = new Date()
  const actorId = await actor()
  const draftId = id('av')

  try {
    const result = await db.transaction(async (tx) => {
      const [parent] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, agentId))
        .for('update')
        .limit(1)
      if (!parent) return { error: 'الموظف الصوتي غير موجود.' } as const

      const versions = await tx
        .select()
        .from(agentVersion)
        .where(eq(agentVersion.agentId, agentId))
        .orderBy(desc(agentVersion.versionNumber))
      if (versions.some((version) => version.status === 'draft')) {
        return { error: 'توجد مسودة مفتوحة بالفعل.' } as const
      }

      const live = versions.find((version) => version.id === parent.liveVersionId)
      if (live?.status !== 'published') {
        return { error: 'لا توجد نسخة منشورة يمكن إنشاء مسودة منها.' } as const
      }

      const [sourceFlows, sourceScenarios] = await Promise.all([
        tx.select().from(flow).where(eq(flow.agentVersionId, live.id)).orderBy(flow.sortOrder),
        tx.select().from(scenarioTest).where(eq(scenarioTest.agentVersionId, live.id)),
      ])
      const nextVersion = (versions[0]?.versionNumber ?? 0) + 1

      await tx.insert(agentVersion).values({
        id: draftId,
        agentId,
        versionNumber: nextVersion,
        status: 'draft',
        identity: live.identity,
        voiceProfileId: live.voiceProfileId,
        businessRules: live.businessRules,
        flows: live.flows,
        toolBindings: live.toolBindings,
        routing: live.routing,
        compiledPrompt: live.compiledPrompt,
        readinessScore: 0,
        blockers: [],
        createdAt: now,
        updatedAt: now,
      })

      if (sourceFlows.length > 0) {
        await tx.insert(flow).values(
          sourceFlows.map((source) => ({
            id: id('flow'),
            agentVersionId: draftId,
            name: source.name,
            goal: source.goal,
            requiredFields: source.requiredFields,
            actions: source.actions,
            fallback: source.fallback,
            sortOrder: source.sortOrder,
            createdAt: now,
          })),
        )
      }

      if (sourceScenarios.length > 0) {
        await tx.insert(scenarioTest).values(
          sourceScenarios.map((source) => ({
            id: id('scenario'),
            agentVersionId: draftId,
            name: source.name,
            category: source.category,
            input: source.input,
            expectedOutcome: source.expectedOutcome,
            isCritical: source.isCritical,
            createdAt: now,
          })),
        )
      }

      await tx.insert(auditLog).values({
        id: id('audit'),
        workspaceId: parent.workspaceId,
        actorId,
        action: 'agent.draft_created',
        resourceType: 'agent_version',
        resourceId: draftId,
        metadata: { note: `إنشاء المسودة v${nextVersion} من v${live.versionNumber}` },
        createdAt: now,
      })

      return { versionId: draftId, versionNumber: nextVersion } as const
    })

    if ('error' in result) return { ok: false, error: result.error }
    revalidatePath('/console/agents')
    revalidatePath(`/console/agents/${agentId}`)
    revalidatePath('/console/test-lab')
    return {
      ok: true,
      message: `أُنشئت المسودة v${result.versionNumber}.`,
      data: { versionId: result.versionId },
    }
  } catch {
    return { ok: false, error: 'تعذر إنشاء المسودة. لم تتغير النسخة المنشورة.' }
  }
}

/** Returns the agent to its previous published version. */
export async function rollbackAgent(agentId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied
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
  const actorId = await actor()

  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: agent.id }).from(agent).where(eq(agent.id, agentId)).for('update')
      if (parent.liveVersionId) {
        await tx
          .update(agentVersion)
          .set({ status: 'archived', updatedAt: now })
          .where(eq(agentVersion.id, parent.liveVersionId))
      }
      await tx
        .update(agentVersion)
        .set({ status: 'published', updatedAt: now })
        .where(eq(agentVersion.id, previous.id))
      await tx
        .update(agent)
        .set({ liveVersionId: previous.id, updatedAt: now })
        .where(eq(agent.id, agentId))
      await tx.insert(auditLog).values({
        id: id('audit'),
        workspaceId: parent.workspaceId,
        actorId,
        action: 'agent.rollback',
        resourceType: 'agent_version',
        resourceId: previous.id,
        metadata: { note: `الرجوع إلى v${previous.versionNumber} — ${parent.name}` },
        createdAt: now,
      })
    })
  } catch {
    return { ok: false, error: 'تعذر الرجوع بصورة ذرية. لم تتغير النسخة الحية.' }
  }

  revalidatePath('/console/agents')
  return { ok: true, message: `تم الرجوع إلى v${previous.versionNumber}.` }
}

/* ─── Integrations ───────────────────────────────────────────────────────── */

const integrationUpdateSchema = z.object({
  connectionId: z.string().min(1),
  credentialsRef: z.string().trim().max(84).optional(),
  endpoints: z.object({
    health: z.string().trim().max(2_048).optional(),
    availability: z.string().trim().max(2_048).optional(),
    booking: z.string().trim().max(2_048).optional(),
    message: z.string().trim().max(2_048).optional(),
  }),
})

const URL_ISSUE_MESSAGE = {
  invalid_url: 'العنوان غير صحيح.',
  https_required: 'يجب أن يبدأ العنوان بـ https://.',
  credentials_forbidden: 'لا تضع بيانات دخول داخل العنوان.',
  port_forbidden: 'يسمح بمنفذ HTTPS القياسي فقط.',
  private_host: 'لا يمكن الاتصال بعنوان داخلي أو محلي.',
} as const

export async function updateIntegrationConnection(
  input: z.input<typeof integrationUpdateSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('integration.manage')
  if (denied) return denied
  const parsed = integrationUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'إعدادات الاتصال غير مكتملة.' }

  const [row] = await db
    .select()
    .from(integrationConnection)
    .where(eq(integrationConnection.id, parsed.data.connectionId))
    .limit(1)
  if (!row) return { ok: false, error: 'الاتصال غير موجود.' }

  const allowed = new Set(capabilitiesForProvider(row.provider))
  const endpoints: Partial<Record<IntegrationAction, string>> = {}
  for (const [action, rawValue] of Object.entries(parsed.data.endpoints) as [
    IntegrationAction,
    string | undefined,
  ][]) {
    const value = rawValue?.trim()
    if (!value) continue
    if (!allowed.has(action)) return { ok: false, error: 'هذا الإجراء غير مدعوم لهذا المزوّد.' }
    const inspected = inspectOutboundUrl(value)
    if (!inspected.ok) return { ok: false, error: URL_ISSUE_MESSAGE[inspected.issue] }
    endpoints[action] = inspected.url.toString()
  }

  const rawReference = parsed.data.credentialsRef?.trim() ?? ''
  const normalizedReference = credentialReference(rawReference)
  if (rawReference && !normalizedReference) {
    return { ok: false, error: 'مرجع المفتاح يجب أن يكون مثل env:CLIENT_CALENDAR_TOKEN.' }
  }

  await db
    .update(integrationConnection)
    .set({
      config: { version: 1, endpoints },
      credentialsRef: normalizedReference,
      health: 'disconnected',
      updatedAt: new Date(),
    })
    .where(eq(integrationConnection.id, row.id))

  await audit({
    workspaceId: row.workspaceId,
    action: 'integration.configuration_updated',
    resourceType: 'integration',
    resourceId: row.id,
    note: `تحديث إعداد ${row.label} — ${Object.keys(endpoints).length} مسارات تشغيل`,
  })

  revalidatePath('/console/integrations')
  revalidatePath('/console')
  return { ok: true, message: `حُفظ إعداد ${row.label}. اختبر الاتصال قبل الاعتماد عليه.` }
}

/** Performs a real, read-only health request through the guarded runtime. */
export async function testIntegration(connectionId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('integration.manage')
  if (denied) return denied
  const [row] = await db
    .select()
    .from(integrationConnection)
    .where(eq(integrationConnection.id, connectionId))
    .limit(1)
  if (!row) return { ok: false, error: 'الاتصال غير موجود.' }

  const result = await invokeIntegration({ connection: row, action: 'health' })

  await audit({
    workspaceId: row.workspaceId,
    action: result.ok ? 'integration.test_passed' : 'integration.test_failed',
    resourceType: 'integration',
    resourceId: row.id,
    note: result.ok
      ? `نجح اختبار ${row.label} خلال ${result.latencyMs}ms`
      : `تعذر اختبار ${row.label} — ${result.code}`,
  })

  revalidatePath('/console/integrations')
  revalidatePath('/console')

  if (result.ok) {
    return { ok: true, message: `${row.label} متصل ويستجيب خلال ${result.latencyMs}ms.` }
  }
  if (result.code === 'not_configured') {
    return { ok: false, error: `${row.label}: أضف عنوان فحص الاتصال أولًا.` }
  }
  if (result.code === 'credential_missing') {
    return { ok: false, error: `${row.label}: مرجع المفتاح غير صالح أو غير موجود في بيئة التشغيل.` }
  }
  return { ok: false, error: `${row.label} غير متاح حاليًا. راجع عنوان الاتصال ثم أعد الاختبار.` }
}

/* ─── Phone ──────────────────────────────────────────────────────────────── */

/**
 * A route test needs a real inbound call, which Ops places. This files the
 * request and tracks it, rather than stamping "verified" on an untested route.
 */
export async function requestPhoneTest(phoneId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied
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

const routeSchema = z
  .object({
    phoneId: z.string().min(1),
    mode: z.enum(['all_calls', 'overflow', 'after_hours']),
    agentId: z.string().min(1).optional(),
    transferDestination: z.string().trim().max(20),
    fallbackDisabled: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.transferDestination && !/^\+?[0-9\s-]{8,20}$/.test(value.transferDestination)) {
      context.addIssue({
        code: 'custom',
        path: ['transferDestination'],
        message: 'رقم التحويل غير صحيح',
      })
    }
    if (!value.transferDestination && !value.fallbackDisabled) {
      context.addIssue({
        code: 'custom',
        path: ['transferDestination'],
        message: 'أضف وجهة تحويل، أو عطّل التحويل صراحةً لهذا الاختبار.',
      })
    }
  })

export async function updatePhoneRoute(input: z.input<typeof routeSchema>): Promise<ActionResult> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied
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

  if (parsed.data.agentId) {
    const [assigned] = await db
      .select({ liveVersionId: agent.liveVersionId, status: agentVersion.status })
      .from(agent)
      .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
      .where(and(eq(agent.id, parsed.data.agentId), eq(agent.workspaceId, row.workspaceId)))
      .limit(1)

    if (!assigned) return { ok: false, error: 'الموظف الصوتي لا يتبع هذا العميل.' }
    if (!assigned.liveVersionId || assigned.status !== 'published') {
      return { ok: false, error: 'اختر موظفًا صوتيًا لديه نسخة منشورة.' }
    }
  }

  const rules = (row.routingRules ?? {}) as Record<string, unknown>

  await db
    .update(phoneNumber)
    .set({
      mode: parsed.data.mode,
      agentId: parsed.data.agentId ?? row.agentId,
      transferDestination: parsed.data.transferDestination
        ? parsed.data.transferDestination.replaceAll(' ', '')
        : null,
      routingRules: { ...rules, fallbackDisabled: parsed.data.fallbackDisabled },
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
  revalidatePath(`/console/phone/${row.id}`)
  return { ok: true, message: `حُدّث توجيه ${row.e164}.` }
}

const phoneStateSchema = z.object({
  phoneId: z.string().min(1),
  action: z.enum(['activate', 'disable']),
})

export async function updatePhoneState(
  input: z.input<typeof phoneStateSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied
  const parsed = phoneStateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'إجراء الهاتف غير صحيح.' }

  const [row] = await db
    .select({
      id: phoneNumber.id,
      e164: phoneNumber.e164,
      workspaceId: phoneNumber.workspaceId,
      agentId: phoneNumber.agentId,
      transferDestination: phoneNumber.transferDestination,
      routingRules: phoneNumber.routingRules,
      verifiedAt: phoneNumber.verifiedAt,
      liveVersionId: agent.liveVersionId,
      liveVersionStatus: agentVersion.status,
    })
    .from(phoneNumber)
    .leftJoin(agent, eq(agent.id, phoneNumber.agentId))
    .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
    .where(eq(phoneNumber.id, parsed.data.phoneId))
    .limit(1)

  if (!row) return { ok: false, error: 'الرقم غير موجود.' }

  if (parsed.data.action === 'disable') {
    await markPhoneDisabled(row.id)
    await audit({
      workspaceId: row.workspaceId,
      action: 'phone.disabled',
      resourceType: 'phone_number',
      resourceId: row.id,
      note: `تعطيل مسار ${row.e164}`,
    })
    revalidatePath('/console/phone')
    revalidatePath(`/console/phone/${row.id}`)
    return { ok: true, message: `عُطّل مسار ${row.e164}.` }
  }

  const rules = (row.routingRules ?? {}) as { fallbackDisabled?: boolean }
  const blockers = [
    !row.agentId && 'لا يوجد موظف صوتي معيّن.',
    (!row.liveVersionId || row.liveVersionStatus !== 'published') && 'لا توجد نسخة منشورة.',
    !row.verifiedAt && 'لم تنجح مكالمة تحقق حقيقية بعد.',
    !row.transferDestination && !rules.fallbackDisabled && 'لم تُضبط وجهة التصعيد.',
  ].filter(Boolean) as string[]

  if (blockers.length) return { ok: false, error: blockers.join(' ') }
  if (!(await markPhoneActive(row.id))) {
    return { ok: false, error: 'تعذّر تفعيل المسار. راجع دليل التحقق.' }
  }

  await audit({
    workspaceId: row.workspaceId,
    action: 'phone.activated',
    resourceType: 'phone_number',
    resourceId: row.id,
    note: `تفعيل مسار ${row.e164}`,
  })
  revalidatePath('/console/phone')
  revalidatePath(`/console/phone/${row.id}`)
  return { ok: true, message: `أصبح ${row.e164} نشطًا.` }
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
  const denied = await requireActionPermission('voice.manage')
  if (denied) return denied
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
  const denied = await requireActionPermission('voice.manage')
  if (denied) return denied
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
  const denied = await requireActionPermission('voice.manage')
  if (denied) return denied
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
  transferTo: z
    .string()
    .trim()
    .max(20)
    .refine((value) => !value || /^\+?[0-9\s-]{8,20}$/.test(value), 'رقم التحويل غير صحيح')
    .optional(),
})

const STATUS_LABEL: Record<string, string> = {
  discovery: 'اكتشاف',
  setup: 'إعداد',
  pilot: 'تجريبي',
  live: 'تشغيل',
  paused: 'موقوف',
}

export async function updateClient(input: z.input<typeof clientSchema>): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied
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
  const nextBusinessInfo = {
    ...info,
    city: parsed.data.city ?? info.city,
    hours: { ...hours, sun_thu: parsed.data.hoursWeekday ?? hours.sun_thu },
    transferTo: parsed.data.transferTo ?? info.transferTo,
  }

  if (row.status !== 'live' && parsed.data.status === 'live') {
    const readiness = await getClientReadinessById(row.id, {
      businessInfo: nextBusinessInfo,
      status: parsed.data.status,
    })
    if (!readiness?.canGoLive) {
      return {
        ok: false,
        error: `لا يمكن بدء التشغيل بعد. ${readiness?.blockers[0] ?? 'راجع خطوات الجاهزية.'}`,
      }
    }
  }

  await db
    .update(workspace)
    .set({
      name: parsed.data.name,
      status: parsed.data.status,
      businessInfo: nextBusinessInfo,
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
  revalidatePath(`/console/clients/${row.slug}`)
  revalidatePath('/console')
  return { ok: true, message: `حُدّثت بيانات ${parsed.data.name}.` }
}
