'use server'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { OperatorPermission } from '@/lib/access'
import {
  capabilitiesForProvider,
  credentialReference,
  type IntegrationAction,
  inspectOutboundUrl,
  optionalCapabilitiesForProvider,
} from '@/lib/integrations'
import { RECORDING_DISCLOSURE_MODES } from '@/lib/recording-policy'
import { createVoiceAgentDraft } from '@/server/agents/create'
import { authorizeOperator } from '@/server/auth/access'
import { getCurrentUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  call,
  changeRequest,
  flow,
  integrationConnection,
  knowledgeItem,
  phoneNumber,
  platformContact,
  pronunciation,
  qaResult,
  salesInquiry,
  scenarioTest,
  voiceProfile,
  workspace,
  workspaceAccess,
} from '@/server/db/schema'
import { invokeIntegration } from '@/server/integrations/runtime'
import { getClientReadinessById } from '@/server/operations/client-readiness'
import { protectString } from '@/server/security/protected-data'
import {
  recordingStorageProblem,
  recordingStorageReady,
  verifyRecordingStorageAccess,
} from '@/server/storage/recordings'
import { getVersionTestGate } from '@/server/test-lab/gate'
import { markPhoneActive, markPhoneDisabled } from '@/server/voice/phone'
import { compilePrompt } from '@/server/voice/prompt'

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

const createAgentSchema = z.object({
  workspaceId: z.string().min(1, 'اختر العميل.'),
  name: z.string().trim().min(2, 'اسم الموظف الصوتي مطلوب.').max(60),
  voiceProfileId: z.string().min(1, 'اختر ملفًا صوتيًا.'),
})

/** Creates a complete first draft from the console, including measurable release tests. */
export async function createVoiceAgent(
  input: z.input<typeof createAgentSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied

  const parsed = createAgentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات الموظف غير صالحة.' }
  }

  const actorId = await actor()

  try {
    const result = await createVoiceAgentDraft({
      ...parsed.data,
      actorId,
    })
    if (!result.ok) return { ok: false, error: result.error }
    revalidatePath('/console/agents')
    revalidatePath(`/console/clients/${result.workspaceSlug}`)
    revalidatePath('/console/test-lab')
    return {
      ok: true,
      message: `أُنشئ ${parsed.data.name} كمسودة مع ${result.scenarioCount} سيناريوهات جاهزة للتشغيل.`,
    }
  } catch (error) {
    console.error('[agent] create failed', error)
    return { ok: false, error: 'تعذر إنشاء الموظف الصوتي. لم تُكتب بيانات جزئية.' }
  }
}

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

const updateDraftSchema = z.object({
  agentId: z.string().min(1),
  versionId: z.string().min(1),
  agentName: z.string().trim().min(2, 'اسم الموظف الصوتي مطلوب').max(60),
  voiceProfileId: z.string().min(1, 'الملف الصوتي مطلوب'),
  identity: z.object({
    role: z.string().trim().min(5, 'الدور الوظيفي مطلوب'),
    goals: z.array(z.string().trim()).default([]),
    restricted: z.array(z.string().trim()).default([]),
  }),
  businessRules: z.object({
    hours: z.string().trim().optional(),
    transferTo: z.string().trim().optional(),
  }),
  routing: z.object({
    afterHours: z.string().trim().optional(),
    escalation: z.string().trim().optional(),
  }),
  flows: z.array(z.string().trim()).default([]),
  toolBindings: z.array(z.string().trim().min(1)).default([]),
  voiceCancellationEnabled: z.boolean().default(false),
})

export async function updateAgentDraft(
  input: z.input<typeof updateDraftSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied

  const parsed = updateDraftSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات المسودة غير صالحة.' }
  }

  const {
    agentId,
    versionId,
    agentName,
    voiceProfileId,
    identity,
    businessRules,
    routing,
    flows,
    toolBindings,
    voiceCancellationEnabled,
  } = parsed.data
  const actorId = await actor()
  const now = new Date()

  try {
    const res = await db.transaction(async (tx) => {
      const [parent] = await tx.select().from(agent).where(eq(agent.id, agentId)).limit(1)
      if (!parent) return { error: 'الموظف الصوتي غير موجود.' }

      const [targetVersion] = await tx
        .select()
        .from(agentVersion)
        .where(and(eq(agentVersion.id, versionId), eq(agentVersion.agentId, agentId)))
        .limit(1)
      if (!targetVersion) return { error: 'النسخة غير موجودة.' }
      if (targetVersion.status !== 'draft') return { error: 'لا يمكن تعديل إلا نسخة بحالة مسودة.' }

      const [ws] = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, parent.workspaceId))
        .limit(1)
      if (!ws) return { error: 'مساحة العمل غير موجودة.' }

      const [prof] = await tx
        .select()
        .from(voiceProfile)
        .where(
          and(
            eq(voiceProfile.id, voiceProfileId),
            or(eq(voiceProfile.workspaceId, parent.workspaceId), eq(voiceProfile.isGlobal, true)),
          ),
        )
        .limit(1)
      if (!prof) return { error: 'الملف الصوتي غير متاح لهذه المنشأة.' }
      const knowledge = await tx
        .select()
        .from(knowledgeItem)
        .where(eq(knowledgeItem.workspaceId, parent.workspaceId))
      const pronunciations = await tx
        .select()
        .from(pronunciation)
        .where(eq(pronunciation.workspaceId, parent.workspaceId))
      const versionFlows = await tx
        .select()
        .from(flow)
        .where(eq(flow.agentVersionId, versionId))
        .orderBy(flow.sortOrder)

      const compiledPrompt = compilePrompt({
        workspace: ws,
        version: {
          ...targetVersion,
          voiceProfileId,
          identity,
          businessRules,
          routing,
          flows,
          toolBindings,
          voiceCancellationEnabled,
        },
        flows: versionFlows,
        agentName,
        profile: prof ?? null,
        knowledge,
        pronunciations,
      })

      if (parent.name !== agentName) {
        await tx.update(agent).set({ name: agentName, updatedAt: now }).where(eq(agent.id, agentId))
      }

      await tx
        .update(agentVersion)
        .set({
          voiceProfileId,
          identity,
          businessRules,
          routing,
          flows,
          toolBindings,
          voiceCancellationEnabled,
          compiledPrompt,
          updatedAt: now,
        })
        .where(eq(agentVersion.id, versionId))

      await tx.insert(auditLog).values({
        id: id('audit'),
        workspaceId: parent.workspaceId,
        actorId,
        action: 'agent.draft_updated',
        resourceType: 'agent_version',
        resourceId: versionId,
        metadata: {
          note: `تحديث إعدادات المسودة v${targetVersion.versionNumber} للموظف ${agentName}`,
        },
        createdAt: now,
      })

      return { ok: true }
    })

    if ('error' in res) return { ok: false, error: res.error }

    revalidatePath('/console/agents')
    revalidatePath(`/console/agents/${agentId}`)
    return { ok: true, message: 'تم حفظ تعديلات المسودة وتحديث التوجيه الصوتي بنجاح.' }
  } catch (error) {
    console.error('[agent] update draft failed', error)
    return { ok: false, error: 'تعذر حفظ تعديلات المسودة.' }
  }
}

const knowledgeSchema = z.object({
  workspaceId: z.string().min(1),
  category: z.enum(['service', 'branch', 'staff', 'policy', 'faq']),
  title: z.string().trim().min(2, 'العنوان قصير جدًا').max(160),
  content: z.record(z.string(), z.unknown()),
})

export async function createKnowledgeItem(
  input: z.input<typeof knowledgeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const parsed = knowledgeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات المعرفة غير صالحة.' }
  }

  const itemId = id('know')
  const now = new Date()
  const actorId = await actor()

  try {
    await db.insert(knowledgeItem).values({
      id: itemId,
      workspaceId: parsed.data.workspaceId,
      category: parsed.data.category,
      title: parsed.data.title,
      content: parsed.data.content,
      source: 'structured',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: parsed.data.workspaceId,
      actorId,
      action: 'knowledge.created',
      resourceType: 'knowledge_item',
      resourceId: itemId,
      metadata: { note: `إضافة عنصر معرفة: ${parsed.data.title} (${parsed.data.category})` },
      createdAt: now,
    })

    revalidatePath('/console/agents')
    revalidatePath('/console/clients')
    return { ok: true, message: `تمت إضافة ${parsed.data.title} بنجاح.`, data: { id: itemId } }
  } catch {
    return { ok: false, error: 'تعذر حفظ عنصر المعرفة.' }
  }
}

const updateKnowledgeSchema = z.object({
  itemId: z.string().min(1),
  category: z.enum(['service', 'branch', 'staff', 'policy', 'faq']),
  title: z.string().trim().min(2, 'العنوان قصير جدًا').max(160),
  content: z.record(z.string(), z.unknown()),
})

export async function updateKnowledgeItem(
  input: z.input<typeof updateKnowledgeSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const parsed = updateKnowledgeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات المعرفة غير صالحة.' }
  }

  const now = new Date()
  const actorId = await actor()

  try {
    const [existing] = await db
      .select()
      .from(knowledgeItem)
      .where(eq(knowledgeItem.id, parsed.data.itemId))
      .limit(1)
    if (!existing) return { ok: false, error: 'عنصر المعرفة غير موجود.' }

    await db
      .update(knowledgeItem)
      .set({
        category: parsed.data.category,
        title: parsed.data.title,
        content: parsed.data.content,
        updatedAt: now,
      })
      .where(eq(knowledgeItem.id, parsed.data.itemId))

    await db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: existing.workspaceId,
      actorId,
      action: 'knowledge.updated',
      resourceType: 'knowledge_item',
      resourceId: parsed.data.itemId,
      metadata: { note: `تحديث عنصر معرفة: ${parsed.data.title}` },
      createdAt: now,
    })

    revalidatePath('/console/agents')
    revalidatePath('/console/clients')
    return { ok: true, message: `تم تحديث ${parsed.data.title} بنجاح.` }
  } catch {
    return { ok: false, error: 'تعذر تحديث عنصر المعرفة.' }
  }
}

export async function deleteKnowledgeItem(itemId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const actorId = await actor()

  try {
    const [existing] = await db
      .select()
      .from(knowledgeItem)
      .where(eq(knowledgeItem.id, itemId))
      .limit(1)
    if (!existing) return { ok: false, error: 'عنصر المعرفة غير موجود.' }

    await db.delete(knowledgeItem).where(eq(knowledgeItem.id, itemId))

    await db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: existing.workspaceId,
      actorId,
      action: 'knowledge.deleted',
      resourceType: 'knowledge_item',
      resourceId: itemId,
      metadata: { note: `حذف عنصر معرفة: ${existing.title}` },
      createdAt: new Date(),
    })

    revalidatePath('/console/agents')
    revalidatePath('/console/clients')
    return { ok: true, message: `تم حذف ${existing.title} بنجاح.` }
  } catch {
    return { ok: false, error: 'تعذر حذف عنصر المعرفة.' }
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

/* ─── CRM feature flag ───────────────────────────────────────────────────── */

const crmFlagSchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean(),
})

/** A packaging decision, not something a client can flip for themselves. */
export async function setClientCrmEnabled(
  input: z.input<typeof crmFlagSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied
  const parsed = crmFlagSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }

  const [row] = await db
    .select({ id: workspace.id, name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }

  await db
    .update(workspace)
    .set({ crmEnabled: parsed.data.enabled, updatedAt: new Date() })
    .where(eq(workspace.id, row.id))

  await audit({
    workspaceId: row.id,
    action: parsed.data.enabled ? 'crm.enabled' : 'crm.disabled',
    resourceType: 'workspace',
    resourceId: row.id,
    note: `${parsed.data.enabled ? 'تفعيل' : 'تعطيل'} CRM لـ ${row.name}`,
  })

  revalidatePath(`/console/clients/${parsed.data.workspaceId}`)
  revalidatePath('/console/clients')
  return {
    ok: true,
    message: parsed.data.enabled ? 'فُعّل CRM لهذا العميل.' : 'عُطّل CRM لهذا العميل.',
  }
}

/* ─── Integrations ───────────────────────────────────────────────────────── */

const integrationUpdateSchema = z.object({
  connectionId: z.string().min(1),
  credentialsRef: z.string().trim().max(84).optional(),
  credentialValue: z.string().max(4_096).optional(),
  clearStoredCredential: z.boolean().optional(),
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

  const allowed = new Set([
    ...capabilitiesForProvider(row.provider),
    ...optionalCapabilitiesForProvider(row.provider),
  ])
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
  const credentialValue = parsed.data.credentialValue ?? ''
  const credentialUpdate = credentialValue
    ? { credentialsEncrypted: protectString(credentialValue), credentialsRef: null }
    : rawReference
      ? { credentialsEncrypted: null, credentialsRef: normalizedReference }
      : parsed.data.clearStoredCredential
        ? { credentialsEncrypted: null, credentialsRef: null }
        : {}

  await db
    .update(integrationConnection)
    .set({
      config: { version: 1, endpoints },
      ...credentialUpdate,
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

/**
 * Registering a number used to require shell access to
 * `scripts/link-test-number.ts` — an operator with `phone.manage` and nothing
 * else could not connect a client's number without someone running a CLI
 * command for them. This is that same insert, reachable from the console.
 *
 * It still does not provision anything with a carrier — MUJAWIB has no
 * telephony-provider API key for the SIP path itself (voice runs on OpenAI's
 * own SIP acceptance of a number already pointed at it — see
 * server/voice/session.ts). The SIP trunk connection stays the ops-team step
 * the phone page already describes; this only removes the terminal from
 * *entering* the number, not from wiring the trunk itself.
 */
const createPhoneSchema = z.object({
  workspaceId: z.string().min(1),
  e164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'أدخل الرقم بصيغة دولية كاملة تبدأ بـ + ورمز الدولة.'),
  label: z.string().trim().max(80).optional(),
})

export async function createPhoneNumber(
  input: z.input<typeof createPhoneSchema>,
): Promise<ActionResult<{ phoneId: string }>> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied
  const parsed = createPhoneSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات الرقم غير صحيحة.' }
  }

  const [ws] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!ws) return { ok: false, error: 'العميل غير موجود.' }

  const [existing] = await db
    .select({ id: phoneNumber.id })
    .from(phoneNumber)
    .where(eq(phoneNumber.e164, parsed.data.e164))
    .limit(1)
  if (existing) return { ok: false, error: 'هذا الرقم مربوط بالفعل.' }

  const phoneId = id('phone')
  const now = new Date()
  await db.insert(phoneNumber).values({
    id: phoneId,
    workspaceId: parsed.data.workspaceId,
    e164: parsed.data.e164,
    label: parsed.data.label || null,
    mode: 'all_calls',
    sipStatus: 'pending',
    routingRules: {},
    createdAt: now,
    updatedAt: now,
  })

  await audit({
    workspaceId: parsed.data.workspaceId,
    action: 'phone.created',
    resourceType: 'phone_number',
    resourceId: phoneId,
    note: `ربط رقم جديد ${parsed.data.e164}`,
  })

  revalidatePath('/console/phone')
  revalidatePath('/console/clients')
  return {
    ok: true,
    message: `أُضيف ${parsed.data.e164}. اضبط التوجيه ثم اطلب مكالمة اختبار.`,
    data: { phoneId },
  }
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

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .refine((value) => !value || /^\+?[0-9\s-]{8,20}$/.test(value), 'رقم غير صحيح')
  .optional()

const clientSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2, 'اسم الشركة مطلوب').max(160),
  status: z.enum(['discovery', 'setup', 'pilot', 'live', 'paused']),
  legalName: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  website: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => !value || /^https?:\/\/[^\s]+\.[^\s]{2,}$/i.test(value),
      'رابط الموقع يجب أن يبدأ بـ http أو https',
    )
    .optional(),
  supportEmail: z
    .string()
    .trim()
    .max(160)
    .refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value), 'بريد غير صحيح')
    .optional(),
  publicPhone: optionalPhone,
  hoursWeekday: z.string().trim().max(40).optional(),
  transferTo: optionalPhone,
  notes: z.string().trim().max(1000).optional(),
  // null = unlimited (workspace_monthly_call_limit_check allows null; the
  // concurrent one is NOT NULL with a > 0 check, so it always has a value).
  monthlyCallLimit: z.number().int().positive().nullable().optional(),
  concurrentCallLimit: z.number().int().positive().optional(),
})

const STATUS_LABEL: Record<string, string> = {
  discovery: 'اكتشاف',
  setup: 'إعداد',
  pilot: 'تجريبي',
  live: 'تشغيل',
  paused: 'موقوف',
  archived: 'مؤرشف',
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

  if (row.status === 'archived') {
    return { ok: false, error: 'العميل مؤرشف. استعده أولًا قبل تعديل بياناته.' }
  }

  const info = (row.businessInfo ?? {}) as Record<string, unknown>
  const hours = (info.hours ?? {}) as Record<string, string>

  // An empty string is a cleared field, not "leave it as it was" — only an
  // absent key falls back to the stored value.
  const keep = (next: string | undefined, current: unknown) => (next === undefined ? current : next)

  const nextBusinessInfo = {
    ...info,
    legalName: keep(parsed.data.legalName, info.legalName),
    industry: keep(parsed.data.industry, info.industry),
    city: keep(parsed.data.city, info.city),
    country: keep(parsed.data.country, info.country),
    website: keep(parsed.data.website, info.website),
    supportEmail: keep(parsed.data.supportEmail, info.supportEmail),
    publicPhone: keep(parsed.data.publicPhone, info.publicPhone),
    notes: keep(parsed.data.notes, info.notes),
    hours: { ...hours, sun_thu: parsed.data.hoursWeekday ?? hours.sun_thu },
    transferTo: keep(parsed.data.transferTo, info.transferTo),
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
      monthlyCallLimit:
        parsed.data.monthlyCallLimit === undefined
          ? row.monthlyCallLimit
          : parsed.data.monthlyCallLimit,
      concurrentCallLimit: parsed.data.concurrentCallLimit ?? row.concurrentCallLimit,
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

const recordingPolicySchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean(),
  disclosureMode: z.enum(RECORDING_DISCLOSURE_MODES),
  jurisdiction: z.string().trim().max(80),
  authorizationConfirmed: z.boolean(),
})

export async function updateClientRecordingPolicy(
  input: z.input<typeof recordingPolicySchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied
  const parsed = recordingPolicySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'سياسة التسجيل غير صحيحة.' }

  const next = parsed.data
  if (next.enabled && next.disclosureMode === 'none') {
    return { ok: false, error: 'اختر كيف سيُبلّغ المتصل قبل تفعيل التسجيل.' }
  }
  if (next.enabled && !next.jurisdiction) {
    return { ok: false, error: 'حدّد الدولة أو النطاق القضائي الذي تمت مراجعته.' }
  }
  if (next.enabled && !next.authorizationConfirmed) {
    return { ok: false, error: 'يلزم تأكيد تفويض العميل والمراجعة النظامية قبل التفعيل.' }
  }

  const [row] = await db
    .select({ id: workspace.id, slug: workspace.slug, name: workspace.name })
    .from(workspace)
    .where(and(eq(workspace.id, next.workspaceId), eq(workspace.type, 'client')))
    .limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }

  const actorId = await actor()
  await db.transaction(async (tx) => {
    await tx
      .update(workspace)
      .set({
        recordingEnabled: next.enabled,
        recordingDisclosureMode: next.enabled ? next.disclosureMode : 'none',
        recordingJurisdiction: next.enabled ? next.jurisdiction : null,
        recordingApprovedAt: next.enabled ? new Date() : null,
        recordingApprovedById: next.enabled ? actorId : null,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, row.id))
    await tx.insert(auditLog).values({
      id: id('audit'),
      workspaceId: row.id,
      actorId,
      action: next.enabled ? 'workspace.recording_enabled' : 'workspace.recording_disabled',
      resourceType: 'workspace',
      resourceId: row.id,
      metadata: {
        disclosureMode: next.enabled ? next.disclosureMode : 'none',
        jurisdiction: next.enabled ? next.jurisdiction : null,
      },
      createdAt: new Date(),
    })
  })

  revalidatePath(`/console/clients/${row.slug}`)
  return {
    ok: true,
    message: next.enabled ? `فُعّل التسجيل المعتمد لـ ${row.name}.` : `أُوقف التسجيل لـ ${row.name}.`,
  }
}

/* ─── Client lifecycle: archive, restore, delete ─────────────────────────── */

/**
 * What a permanent delete would destroy.
 *
 * Counted from the database rather than estimated, and shown before the
 * confirmation. "Delete this client" reads as a small act until you see that
 * it also means several thousand call records; an operator who can see the
 * number can decide whether archiving is what they actually wanted.
 */
export type ClientDeletionImpact = {
  workspaceId: string
  name: string
  agents: number
  versions: number
  calls: number
  liveCalls: number
  phoneNumbers: number
  activeRoutes: number
  integrations: number
  users: number
  requests: number
}

const TALLY = { n: sql<number>`count(*)`.mapWith(Number) }

async function countRows(query: PromiseLike<{ n: number }[]>): Promise<number> {
  return (await query)[0]?.n ?? 0
}

export async function getClientDeletionImpact(
  workspaceId: string,
): Promise<ActionResult<ClientDeletionImpact>> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const [row] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }

  const [agents, versions, calls, liveCalls, phones, activeRoutes, integrations, users, requests] =
    await Promise.all([
      countRows(db.select(TALLY).from(agent).where(eq(agent.workspaceId, workspaceId))),
      countRows(
        db
          .select(TALLY)
          .from(agentVersion)
          .innerJoin(agent, eq(agentVersion.agentId, agent.id))
          .where(eq(agent.workspaceId, workspaceId)),
      ),
      countRows(db.select(TALLY).from(call).where(eq(call.workspaceId, workspaceId))),
      countRows(
        db
          .select(TALLY)
          .from(call)
          .where(
            and(eq(call.workspaceId, workspaceId), inArray(call.status, ['live', 'waiting_tool'])),
          ),
      ),
      countRows(db.select(TALLY).from(phoneNumber).where(eq(phoneNumber.workspaceId, workspaceId))),
      countRows(
        db
          .select(TALLY)
          .from(phoneNumber)
          .where(
            and(
              eq(phoneNumber.workspaceId, workspaceId),
              inArray(phoneNumber.sipStatus, ['verified', 'active']),
            ),
          ),
      ),
      countRows(
        db
          .select(TALLY)
          .from(integrationConnection)
          .where(eq(integrationConnection.workspaceId, workspaceId)),
      ),
      countRows(
        db.select(TALLY).from(workspaceAccess).where(eq(workspaceAccess.workspaceId, workspaceId)),
      ),
      countRows(
        db.select(TALLY).from(changeRequest).where(eq(changeRequest.workspaceId, workspaceId)),
      ),
    ])

  return {
    ok: true,
    message: 'حُسبت السجلات المرتبطة.',
    data: {
      workspaceId,
      name: row.name,
      agents,
      versions,
      calls,
      liveCalls,
      phoneNumbers: phones,
      activeRoutes,
      integrations,
      users,
      requests,
    },
  }
}

/**
 * Takes a client out of service without destroying anything.
 *
 * Archiving disables its phone routes too. A number that still rings through
 * to an archived client is the worst of both worlds: invisible in every
 * console view, and answering real callers.
 */
export async function archiveClient(workspaceId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const [row] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }
  if (row.type === 'operator') return { ok: false, error: 'لا يمكن أرشفة مساحة عمل المنصة.' }
  if (row.status === 'archived') return { ok: false, error: 'العميل مؤرشف بالفعل.' }

  const liveCalls = await countRows(
    db
      .select(TALLY)
      .from(call)
      .where(
        and(eq(call.workspaceId, workspaceId), inArray(call.status, ['live', 'waiting_tool'])),
      ),
  )
  if (liveCalls > 0) {
    return {
      ok: false,
      error: `لدى العميل ${liveCalls} مكالمة جارية. انتظر انتهاءها ثم أعد المحاولة.`,
    }
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(workspace)
      .set({ status: 'archived', updatedAt: now })
      .where(eq(workspace.id, workspaceId))
    await tx
      .update(phoneNumber)
      .set({ sipStatus: 'disabled', updatedAt: now })
      .where(eq(phoneNumber.workspaceId, workspaceId))
  })

  await audit({
    workspaceId,
    action: 'client.archive',
    resourceType: 'workspace',
    resourceId: workspaceId,
    note: `أُرشف «${row.name}» وعُطّلت أرقامه`,
  })

  revalidatePath('/console/clients')
  revalidatePath(`/console/clients/${row.slug}`)
  revalidatePath('/console/phone')
  return { ok: true, message: `أُرشف «${row.name}». بياناته محفوظة ويمكن استعادته.` }
}

/**
 * Brings an archived client back, paused rather than live.
 *
 * Its phone routes stay disabled: the archive switched them off, and turning
 * them back on is a decision about answering real callers that belongs to the
 * phone screen, not to a restore button.
 */
export async function restoreClient(workspaceId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('client.manage')
  if (denied) return denied

  const [row] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }
  if (row.status !== 'archived') return { ok: false, error: 'العميل غير مؤرشف.' }

  await db
    .update(workspace)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId))

  await audit({
    workspaceId,
    action: 'client.restore',
    resourceType: 'workspace',
    resourceId: workspaceId,
    note: `استُعيد «${row.name}» بحالة موقوف`,
  })

  revalidatePath('/console/clients')
  revalidatePath(`/console/clients/${row.slug}`)
  return {
    ok: true,
    message: `استُعيد «${row.name}» بحالة موقوف. فعّل أرقامه من شاشة الهاتف عند الجاهزية.`,
  }
}

const deleteClientSchema = z.object({
  workspaceId: z.string().min(1),
  /** The operator retypes the exact client name. Nothing else unlocks this. */
  confirmation: z.string().trim().min(1),
})

/**
 * Destroys a client and everything that references it.
 *
 * Restricted to the platform owner, gated behind retyping the client's exact
 * name, and refused outright while a call is in progress. Every other path
 * here prefers archiving; this exists for what archiving cannot answer, such
 * as a client who asks to be erased.
 */
export async function deleteClientPermanently(
  input: z.input<typeof deleteClientSchema>,
): Promise<ActionResult> {
  const access = await authorizeOperator('client.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' }
  if (access.role !== 'owner') {
    return {
      ok: false,
      error: 'الحذف النهائي متاح لمالك المنصة فقط. يمكنك أرشفة العميل بدلًا منه.',
    }
  }

  const parsed = deleteClientSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }

  const [row] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!row) return { ok: false, error: 'العميل غير موجود.' }
  if (row.type === 'operator') return { ok: false, error: 'لا يمكن حذف مساحة عمل المنصة.' }
  if (parsed.data.confirmation !== row.name) {
    return { ok: false, error: 'الاسم المكتوب لا يطابق اسم العميل. لم يُحذف شيء.' }
  }

  const liveCalls = await countRows(
    db
      .select(TALLY)
      .from(call)
      .where(
        and(
          eq(call.workspaceId, parsed.data.workspaceId),
          inArray(call.status, ['live', 'waiting_tool']),
        ),
      ),
  )
  if (liveCalls > 0) return { ok: false, error: 'لا يمكن الحذف أثناء وجود مكالمة جارية.' }

  // Written before the delete: afterwards there is no workspace row left to
  // hang an audit entry on, and this is the one action worth looking up later.
  await audit({
    workspaceId: null,
    action: 'client.delete',
    resourceType: 'workspace',
    resourceId: row.id,
    note: `حذف نهائي لـ «${row.name}» (${row.slug})`,
  })

  // Every child table cascades from workspace.
  await db.delete(workspace).where(eq(workspace.id, parsed.data.workspaceId))

  revalidatePath('/console/clients')
  revalidatePath('/console')
  revalidatePath('/console/phone')
  return { ok: true, message: `حُذف «${row.name}» نهائيًا.` }
}

/* ─── Phone reassignment ─────────────────────────────────────────────────── */

/** One client's assignable voice employees, for the reassignment picker. */
export type ReassignTarget = {
  workspaceId: string
  workspaceName: string
  slug: string
  status: string
  agents: {
    agentId: string
    agentName: string
    versionId: string | null
    versionNumber: number | null
    publishable: boolean
  }[]
}

/**
 * Everywhere a DID could legitimately be pointed.
 *
 * Only clients that are not archived, and within them only agents carrying a
 * published version, can receive a route — the same rule the inbound webhook
 * applies. Agents without one are still listed, marked unpublishable, so the
 * operator sees why the option is unavailable rather than wondering where the
 * voice employee they just created went.
 */
export async function getReassignTargets(): Promise<ActionResult<ReassignTarget[]>> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied

  const rows = await db
    .select({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      agentId: agent.id,
      agentName: agent.name,
      liveVersionId: agent.liveVersionId,
      versionNumber: agentVersion.versionNumber,
      versionStatus: agentVersion.status,
    })
    .from(workspace)
    .leftJoin(agent, eq(agent.workspaceId, workspace.id))
    .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
    .where(and(eq(workspace.type, 'client'), ne(workspace.status, 'archived')))
    .orderBy(workspace.name, agent.name)

  const byWorkspace = new Map<string, ReassignTarget>()
  for (const row of rows) {
    let target = byWorkspace.get(row.workspaceId)
    if (!target) {
      target = {
        workspaceId: row.workspaceId,
        workspaceName: row.workspaceName,
        slug: row.slug,
        status: row.status,
        agents: [],
      }
      byWorkspace.set(row.workspaceId, target)
    }
    if (!row.agentId) continue
    target.agents.push({
      agentId: row.agentId,
      agentName: row.agentName ?? '—',
      versionId: row.liveVersionId,
      versionNumber: row.versionNumber,
      publishable: Boolean(row.liveVersionId) && row.versionStatus === 'published',
    })
  }

  return { ok: true, message: 'جاهز.', data: [...byWorkspace.values()] }
}

const reassignSchema = z.object({
  phoneId: z.string().min(1),
  workspaceId: z.string().min(1),
  agentId: z.string().min(1),
})

/**
 * Points an existing DID at a different client and voice employee.
 *
 * This is the operation the console was missing: a number could be created
 * against a client and its routing mode edited, but never moved, so testing
 * how a second client answers meant editing the database by hand.
 *
 * Three things make it safe to run against production:
 *
 * A DID has exactly one route. `phone_number.e164` is unique, and this moves
 * that single row rather than adding a second one, so a number can never be
 * pointed at two clients at once — which would make which agent answers a race.
 *
 * The target must be able to answer. The agent has to belong to the chosen
 * client and carry a published version, the same condition the inbound webhook
 * checks; refusing here means the operator finds out now rather than when a
 * caller hears silence.
 *
 * Verification does not survive the move. The number was proved against a
 * different client's agent, and that evidence says nothing about the new one,
 * so it returns to `pending` and has to earn `verified` with a real call
 * again. Carrying the old badge across would be the exact thing the phone
 * lifecycle exists to prevent.
 */
export async function reassignPhoneNumber(
  input: z.input<typeof reassignSchema>,
): Promise<ActionResult> {
  const denied = await requireActionPermission('phone.manage')
  if (denied) return denied

  const parsed = reassignSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }

  const [row] = await db
    .select()
    .from(phoneNumber)
    .where(eq(phoneNumber.id, parsed.data.phoneId))
    .limit(1)
  if (!row) return { ok: false, error: 'الرقم غير موجود.' }

  const [target] = await db
    .select({
      workspaceName: workspace.name,
      workspaceStatus: workspace.status,
      workspaceSlug: workspace.slug,
      agentId: agent.id,
      agentName: agent.name,
      liveVersionId: agent.liveVersionId,
      versionNumber: agentVersion.versionNumber,
      versionStatus: agentVersion.status,
    })
    .from(agent)
    .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
    .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
    .where(and(eq(agent.id, parsed.data.agentId), eq(agent.workspaceId, parsed.data.workspaceId)))
    .limit(1)

  if (!target) return { ok: false, error: 'الموظف الصوتي لا يتبع العميل المختار.' }
  if (target.workspaceStatus === 'archived') {
    return { ok: false, error: 'لا يمكن توجيه رقم إلى عميل مؤرشف.' }
  }
  if (!target.liveVersionId || target.versionStatus !== 'published') {
    return {
      ok: false,
      error: `«${target.agentName}» ليس لديه نسخة منشورة. انشر نسخة أولًا حتى يستطيع الرد.`,
    }
  }

  const liveCalls = await countRows(
    db
      .select(TALLY)
      .from(call)
      .where(and(eq(call.phoneNumberId, row.id), inArray(call.status, ['live', 'waiting_tool']))),
  )
  if (liveCalls > 0) {
    return { ok: false, error: 'الرقم عليه مكالمة جارية الآن. انتظر انتهاءها ثم أعد التوجيه.' }
  }

  const unchanged =
    row.workspaceId === parsed.data.workspaceId && row.agentId === parsed.data.agentId
  if (unchanged) return { ok: false, error: 'الرقم موجّه بالفعل إلى هذا الموظف.' }

  const [previous] = await db
    .select({ workspaceName: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, row.workspaceId))
    .limit(1)

  const now = new Date()
  const rules = (row.routingRules ?? {}) as Record<string, unknown>
  const history = Array.isArray(rules.history) ? (rules.history as unknown[]) : []

  await db
    .update(phoneNumber)
    .set({
      workspaceId: parsed.data.workspaceId,
      agentId: parsed.data.agentId,
      // The move invalidates what the old route proved.
      sipStatus: 'pending',
      verifiedAt: null,
      verificationEvidence: null,
      // Escalation belonged to the previous client's team.
      transferDestination: null,
      routingRules: {
        ...rules,
        history: [
          ...history.slice(-19),
          {
            at: now.toISOString(),
            fromWorkspaceId: row.workspaceId,
            fromWorkspaceName: previous?.workspaceName ?? null,
            fromAgentId: row.agentId,
            toWorkspaceId: parsed.data.workspaceId,
            toWorkspaceName: target.workspaceName,
            toAgentId: parsed.data.agentId,
            toAgentName: target.agentName,
            toVersionNumber: target.versionNumber,
          },
        ],
      },
      updatedAt: now,
    })
    .where(eq(phoneNumber.id, row.id))

  // Recorded against both sides: the client that lost the number and the one
  // that gained it each need it in their own trail.
  await audit({
    workspaceId: row.workspaceId,
    action: 'phone.reassigned_away',
    resourceType: 'phone_number',
    resourceId: row.id,
    note: `نُقل ${row.e164} إلى ${target.workspaceName}`,
  })
  await audit({
    workspaceId: parsed.data.workspaceId,
    action: 'phone.reassigned_to',
    resourceType: 'phone_number',
    resourceId: row.id,
    note: `استلم ${row.e164} من ${previous?.workspaceName ?? 'عميل سابق'} — ${target.agentName} v${target.versionNumber}`,
  })

  revalidatePath('/console/phone')
  revalidatePath(`/console/phone/${row.id}`)
  revalidatePath('/console/clients')
  return {
    ok: true,
    message: `${row.e164} يرد عليه الآن «${target.agentName}» لدى ${target.workspaceName}. اتصل بالرقم لإعادة توثيق المسار.`,
  }
}

/* ─── Agent delete ────────────────────────────────────────────────────────── */

/**
 * Removes a voice employee that never went into real service.
 *
 * There is no archive state for an agent the way there is for a workspace —
 * an agent with no published version and no call ever routed through it has
 * nothing real hanging off it, so a straightforward delete is safe. One that
 * has been published, or that a phone number currently points at, is refused
 * outright rather than silently orphaning a route or a call's own agent
 * reference; the operator unpublishes or reassigns the number first, which
 * are both already real, safe actions elsewhere in the console.
 */
export async function deleteAgent(agentId: string): Promise<ActionResult> {
  const denied = await requireActionPermission('agent.publish')
  if (denied) return denied

  const [row] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1)
  if (!row) return { ok: false, error: 'الموظف الصوتي غير موجود.' }

  if (row.liveVersionId) {
    const [live] = await db
      .select({ status: agentVersion.status })
      .from(agentVersion)
      .where(eq(agentVersion.id, row.liveVersionId))
      .limit(1)
    if (live?.status === 'published') {
      return {
        ok: false,
        error: 'هذا الموظف لديه نسخة منشورة. ألغِ النشر أو ارجع لنسخة سابقة قبل الحذف.',
      }
    }
  }

  const routedPhones = await countRows(
    db.select(TALLY).from(phoneNumber).where(eq(phoneNumber.agentId, agentId)),
  )
  if (routedPhones > 0) {
    return {
      ok: false,
      error: `${routedPhones} رقم هاتف موجّه لهذا الموظف. أعد توجيه الأرقام إلى موظف آخر أولًا.`,
    }
  }

  const calls = await countRows(
    db
      .select(TALLY)
      .from(call)
      .innerJoin(agentVersion, eq(call.agentVersionId, agentVersion.id))
      .where(eq(agentVersion.agentId, agentId)),
  )
  if (calls > 0) {
    return {
      ok: false,
      error: `${calls} مكالمة مسجّلة على نسخ من هذا الموظف. لا يمكن حذفه دون فقدان سجلها.`,
    }
  }

  await audit({
    workspaceId: row.workspaceId,
    action: 'agent.delete',
    resourceType: 'agent',
    resourceId: agentId,
    note: `حذف الموظف الصوتي «${row.name}» — لم يُنشر ولا سجلّ مكالمات`,
  })

  // Versions cascade from agent.id.
  await db.delete(agent).where(eq(agent.id, agentId))

  revalidatePath('/console/agents')
  return { ok: true, message: `حُذف «${row.name}».` }
}

/* ─── Platform contact settings ──────────────────────────────────────────── */

const platformContactSchema = z.object({
  email: z
    .string()
    .trim()
    .max(160)
    .refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value), 'بريد غير صحيح')
    .optional(),
  emailConfirmed: z.boolean(),
  phoneE164: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => !value || /^\+[0-9]{8,15}$/.test(value),
      'الرقم يجب أن يبدأ بـ + بصيغة دولية',
    )
    .optional(),
  phoneDisplay: z.string().trim().max(30).optional(),
  phoneConfirmed: z.boolean(),
  whatsappEnabled: z.boolean(),
})

/**
 * The one place that decides what the public site is allowed to claim about
 * how to reach the company. Owner-only: a wrong value here is wrong on every
 * page, not scoped to one client workspace the way most console edits are.
 *
 * Confirming a channel is a factual claim ("this inbox is read," "this number
 * takes WhatsApp"), not a form validation the operator can satisfy by typing
 * something that matches a regex — so the checkboxes are trusted as spoken,
 * with no attempt to verify the claim from here.
 */
export async function updatePlatformContact(
  input: z.input<typeof platformContactSchema>,
): Promise<ActionResult> {
  const access = await authorizeOperator('system.view')
  if (!access) return { ok: false, error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' }
  if (access.role !== 'owner') {
    return { ok: false, error: 'تعديل قنوات التواصل العامة متاح لمالك المنصة فقط.' }
  }

  const parsed = platformContactSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة.' }

  if (parsed.data.emailConfirmed && !parsed.data.email) {
    return { ok: false, error: 'لا يمكن تأكيد بريد فارغ.' }
  }
  if (parsed.data.phoneConfirmed && !(parsed.data.phoneE164 && parsed.data.phoneDisplay)) {
    return { ok: false, error: 'لا يمكن تأكيد رقم فارغ.' }
  }
  if (parsed.data.whatsappEnabled && !parsed.data.phoneConfirmed) {
    return { ok: false, error: 'أكّد الرقم أولًا قبل تفعيل واتساب عليه.' }
  }

  const now = new Date()
  const updatedById = await actor()

  await db
    .insert(platformContact)
    .values({
      id: 'default',
      email: parsed.data.email || null,
      emailConfirmed: parsed.data.emailConfirmed,
      phoneE164: parsed.data.phoneE164 || null,
      phoneDisplay: parsed.data.phoneDisplay || null,
      phoneConfirmed: parsed.data.phoneConfirmed,
      whatsappEnabled: parsed.data.whatsappEnabled,
      updatedAt: now,
      updatedById,
    })
    .onConflictDoUpdate({
      target: platformContact.id,
      set: {
        email: parsed.data.email || null,
        emailConfirmed: parsed.data.emailConfirmed,
        phoneE164: parsed.data.phoneE164 || null,
        phoneDisplay: parsed.data.phoneDisplay || null,
        phoneConfirmed: parsed.data.phoneConfirmed,
        whatsappEnabled: parsed.data.whatsappEnabled,
        updatedAt: now,
        updatedById,
      },
    })

  await audit({
    workspaceId: null,
    action: 'system.contact_update',
    resourceType: 'platform_contact',
    resourceId: 'default',
    note: `تحديث قنوات التواصل — البريد ${parsed.data.emailConfirmed ? 'مؤكَّد' : 'غير مؤكَّد'}, الهاتف ${parsed.data.phoneConfirmed ? 'مؤكَّد' : 'غير مؤكَّد'}`,
  })

  revalidatePath('/console/system')
  revalidatePath('/')
  revalidatePath('/en')
  revalidatePath('/contact')
  revalidatePath('/privacy')
  return { ok: true, message: 'حُفظت قنوات التواصل.' }
}

/** Runs a private, random Put/Get/Delete probe without exposing storage coordinates. */
export async function verifyRecordingStorage(): Promise<ActionResult> {
  const denied = await requireActionPermission('integration.manage')
  if (denied) return denied

  const problem = recordingStorageProblem()
  if (problem) return { ok: false, error: `إعدادات التخزين غير مكتملة: ${problem}` }
  if (!recordingStorageReady()) {
    return { ok: false, error: 'تخزين التسجيلات غير مفعّل في بيئة التشغيل.' }
  }

  try {
    await verifyRecordingStorageAccess()
    await audit({
      workspaceId: null,
      action: 'system.recording_storage_verified',
      resourceType: 'recording_storage',
      resourceId: 'private',
      note: 'نجح اختبار الكتابة والقراءة والحذف لتخزين التسجيلات الخاص',
    })
    revalidatePath('/console/system')
    return { ok: true, message: 'تخزين التسجيلات يعمل: نجحت الكتابة والقراءة والحذف.' }
  } catch {
    return {
      ok: false,
      error: 'فشل الوصول الفعلي للتخزين. راجع صلاحيات R2 ثم أعد الاختبار.',
    }
  }
}
