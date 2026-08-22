import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  integrationConnection,
  knowledgeItem,
  phoneNumber,
  workspace,
} from '@/server/db/schema'
import { getVersionTestGate } from '@/server/test-lab/gate'

export type ReadinessState = 'complete' | 'attention' | 'blocked'
export type ReadinessKey = 'business' | 'agent' | 'phone' | 'integrations' | 'qa' | 'go_live'

export type ReadinessStep = {
  key: ReadinessKey
  label: string
  state: ReadinessState
  detail: string
  nextAction: string | null
  owner: string
  href: string
}

export type ClientReadiness = {
  steps: ReadinessStep[]
  completed: number
  total: number
  score: number
  canGoLive: boolean
  blockers: string[]
  nextStep: ReadinessStep | null
}

type ReadinessOverrides = {
  businessInfo?: Record<string, unknown>
  status?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

/**
 * One evidence-based setup model used by both the Operator UI and the go-live
 * gate. A client cannot look ready in one screen and fail for a different,
 * hidden set of rules when Ops tries to launch it.
 */
export async function getClientReadinessById(
  workspaceId: string,
  overrides: ReadinessOverrides = {},
): Promise<ClientReadiness | null> {
  const [ws] = await db
    .select({
      id: workspace.id,
      slug: workspace.slug,
      status: workspace.status,
      businessInfo: workspace.businessInfo,
    })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1)

  if (!ws) return null

  const [agents, phones, integrations, knowledge] = await Promise.all([
    db
      .select({
        id: agent.id,
        liveVersionId: agent.liveVersionId,
        versionStatus: agentVersion.status,
        toolBindings: agentVersion.toolBindings,
      })
      .from(agent)
      .leftJoin(agentVersion, eq(agentVersion.id, agent.liveVersionId))
      .where(eq(agent.workspaceId, workspaceId)),
    db
      .select({
        agentId: phoneNumber.agentId,
        sipStatus: phoneNumber.sipStatus,
        verifiedAt: phoneNumber.verifiedAt,
        transferDestination: phoneNumber.transferDestination,
        routingRules: phoneNumber.routingRules,
      })
      .from(phoneNumber)
      .where(eq(phoneNumber.workspaceId, workspaceId)),
    db
      .select({
        provider: integrationConnection.provider,
        health: integrationConnection.health,
      })
      .from(integrationConnection)
      .where(eq(integrationConnection.workspaceId, workspaceId)),
    db
      .select({ category: knowledgeItem.category })
      .from(knowledgeItem)
      .where(eq(knowledgeItem.workspaceId, workspaceId)),
  ])

  const publishedAgents = agents.filter(
    (item) => item.liveVersionId && item.versionStatus === 'published',
  )
  const liveVersionIds = publishedAgents
    .map((item) => item.liveVersionId)
    .filter((id): id is string => Boolean(id))

  const testGates = (
    await Promise.all(liveVersionIds.map((versionId) => getVersionTestGate(versionId)))
  ).filter((gate): gate is NonNullable<typeof gate> => Boolean(gate))

  const info = overrides.businessInfo ?? asRecord(ws.businessInfo)
  const hours = asRecord(info.hours)
  const hasServices = knowledge.some((item) => item.category === 'service')
  const hasBranches =
    stringList(info.branches).length > 0 || knowledge.some((item) => item.category === 'branch')
  const businessMissing = [
    !nonEmpty(info.city) && 'المدينة',
    !nonEmpty(hours.sun_thu) && 'ساعات العمل',
    !hasServices && 'الخدمات',
    !hasBranches && 'الفروع',
  ].filter(Boolean) as string[]

  const businessStep: ReadinessStep = businessMissing.length
    ? {
        key: 'business',
        label: 'بيانات النشاط',
        state: 'blocked',
        detail: `ناقص: ${businessMissing.join('، ')}`,
        nextAction: 'أكمل بيانات النشاط والمعرفة الأساسية',
        owner: 'فريق الإعداد',
        href: `/console/clients/${ws.slug}`,
      }
    : {
        key: 'business',
        label: 'بيانات النشاط',
        state: 'complete',
        detail: 'الخدمات والفروع وساعات العمل جاهزة',
        nextAction: null,
        owner: 'فريق الإعداد',
        href: `/console/clients/${ws.slug}`,
      }

  const agentStep: ReadinessStep = publishedAgents.length
    ? {
        key: 'agent',
        label: 'الموظف الصوتي',
        state: 'complete',
        detail: `${publishedAgents.length} موظف بنسخة منشورة`,
        nextAction: null,
        owner: 'فريق الصوت',
        href: '/console/agents',
      }
    : {
        key: 'agent',
        label: 'الموظف الصوتي',
        state: 'blocked',
        detail: 'لا توجد نسخة منشورة جاهزة للمكالمات',
        nextAction: 'راجع المسودة وانشر نسخة تشغيل',
        owner: 'فريق الصوت',
        href: '/console/agents',
      }

  const publishedAgentIds = new Set(publishedAgents.map((item) => item.id))
  const provenPhones = phones.filter(
    (item) =>
      item.agentId &&
      publishedAgentIds.has(item.agentId) &&
      item.verifiedAt &&
      (item.sipStatus === 'verified' || item.sipStatus === 'active'),
  )
  const phoneFallbackReady = provenPhones.some((item) => {
    const rules = asRecord(item.routingRules)
    return Boolean(item.transferDestination || rules.fallbackDisabled === true)
  })
  const phoneStep: ReadinessStep =
    provenPhones.length > 0 && phoneFallbackReady
      ? {
          key: 'phone',
          label: 'الهاتف',
          state: 'complete',
          detail: `${provenPhones.length} مسار مثبت بمكالمة حقيقية`,
          nextAction: null,
          owner: 'فريق التشغيل',
          href: '/console/phone',
        }
      : {
          key: 'phone',
          label: 'الهاتف',
          state: 'blocked',
          detail:
            provenPhones.length === 0
              ? 'لا يوجد رقم مثبت ومربوط بنسخة منشورة'
              : 'قرار التحويل البشري غير مكتمل',
          nextAction:
            provenPhones.length === 0
              ? 'اربط الرقم ونفّذ مكالمة تحقق'
              : 'اضبط التحويل أو عطّله صراحةً للاختبار',
          owner: 'فريق التشغيل',
          href: '/console/phone',
        }

  const requiredProviders = new Set(
    publishedAgents.flatMap((item) => stringList(item.toolBindings)),
  )
  const connectedProviders = new Set(
    integrations.filter((item) => item.health === 'connected').map((item) => item.provider),
  )
  const missingIntegrations = [...requiredProviders].filter(
    (provider) => !connectedProviders.has(provider),
  )
  const integrationStep: ReadinessStep =
    requiredProviders.size === 0
      ? {
          key: 'integrations',
          label: 'الأنظمة الخارجية',
          state: 'complete',
          detail: 'النسخة الحالية لا تعتمد على إجراءات خارجية',
          nextAction: null,
          owner: 'فريق الربط',
          href: '/console/integrations',
        }
      : missingIntegrations.length === 0
        ? {
            key: 'integrations',
            label: 'الأنظمة الخارجية',
            state: 'complete',
            detail: `${requiredProviders.size} اتصال مطلوب يعمل`,
            nextAction: null,
            owner: 'فريق الربط',
            href: '/console/integrations',
          }
        : {
            key: 'integrations',
            label: 'الأنظمة الخارجية',
            state: 'blocked',
            detail: `${missingIntegrations.length} اتصال مطلوب غير جاهز`,
            nextAction: 'أكمل الربط واختبر كل إجراء مطلوب',
            owner: 'فريق الربط',
            href: '/console/integrations',
          }

  const totalTests = testGates.reduce((sum, gate) => sum + gate.total, 0)
  const freshTests = testGates.reduce((sum, gate) => sum + gate.fresh, 0)
  const failedCritical = testGates.reduce((sum, gate) => sum + gate.criticalFailed, 0)
  const failedOptional = testGates.reduce((sum, gate) => sum + gate.nonCriticalFailed, 0)
  const blockedGates = testGates.filter((gate) => !gate.canPublish)
  const qaStep: ReadinessStep =
    totalTests === 0
      ? {
          key: 'qa',
          label: 'اختبار الجودة',
          state: publishedAgents.length ? 'blocked' : 'attention',
          detail: 'لا توجد سيناريوهات مسجلة لهذه النسخة بعد',
          nextAction: 'أضف سيناريوهات أساسية قبل التوسع',
          owner: 'فريق الجودة',
          href: '/console/test-lab',
        }
      : blockedGates.length > 0
        ? {
            key: 'qa',
            label: 'اختبار الجودة',
            state: 'blocked',
            detail:
              failedCritical > 0
                ? `${failedCritical} سيناريو حرج لم ينجح`
                : `${totalTests - freshTests} نتيجة مفقودة أو قديمة`,
            nextAction: 'شغّل الحزمة الحالية وعالج النتائج التي لم تنجح',
            owner: 'فريق الجودة',
            href: '/console/test-lab',
          }
        : failedOptional > 0
          ? {
              key: 'qa',
              label: 'اختبار الجودة',
              state: 'attention',
              detail: `${failedOptional} سيناريو غير حرج يحتاج متابعة`,
              nextAction: 'راجع الإخفاقات غير الحرجة قبل التوسع',
              owner: 'فريق الجودة',
              href: '/console/test-lab',
            }
          : {
              key: 'qa',
              label: 'اختبار الجودة',
              state: 'complete',
              detail: `${totalTests} سيناريو بنتائج حديثة بلا إخفاق حرج`,
              nextAction: null,
              owner: 'فريق الجودة',
              href: '/console/test-lab',
            }

  const prerequisites = [businessStep, agentStep, phoneStep, integrationStep, qaStep]
  const blockingSteps = prerequisites.filter((step) => step.state === 'blocked')
  const canGoLive = blockingSteps.length === 0
  const targetStatus = overrides.status ?? ws.status
  const goLiveStep: ReadinessStep =
    targetStatus === 'live'
      ? {
          key: 'go_live',
          label: 'التشغيل',
          state: canGoLive ? 'complete' : 'attention',
          detail: canGoLive ? 'العميل في التشغيل' : 'يعمل حاليًا مع نقاط تحتاج معالجة',
          nextAction: canGoLive ? null : 'عالج الموانع قبل أي توسع',
          owner: 'مدير التشغيل',
          href: `/console/clients/${ws.slug}`,
        }
      : canGoLive
        ? {
            key: 'go_live',
            label: 'التشغيل',
            state: 'attention',
            detail: 'اكتملت الشروط الإلزامية وبقي قرار الإطلاق',
            nextAction: 'راجع الإعداد ثم انقل العميل إلى التشغيل',
            owner: 'مدير التشغيل',
            href: `/console/clients/${ws.slug}`,
          }
        : {
            key: 'go_live',
            label: 'التشغيل',
            state: 'blocked',
            detail: `${blockingSteps.length} مانع قبل التشغيل`,
            nextAction: blockingSteps[0]?.nextAction ?? 'عالج الموانع',
            owner: 'مدير التشغيل',
            href: `/console/clients/${ws.slug}`,
          }

  const steps = [...prerequisites, goLiveStep]
  const completed = steps.filter((step) => step.state === 'complete').length

  return {
    steps,
    completed,
    total: steps.length,
    score: Math.round((completed / steps.length) * 100),
    canGoLive,
    blockers: blockingSteps.map((step) => `${step.label}: ${step.detail}`),
    nextStep: steps.find((step) => step.state !== 'complete') ?? null,
  }
}
