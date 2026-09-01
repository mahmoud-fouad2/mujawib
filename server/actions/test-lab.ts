'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { SCENARIO_CATEGORIES, scenarioExpectationSchema, scenarioInputSchema } from '@/lib/test-lab'
import { limitAction } from '@/server/actions/guard'
import { authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import { agent, agentVersion, auditLog, scenarioTest } from '@/server/db/schema'
import { notifyOperators, tryNotify } from '@/server/notifications/service'
import { executeAndPersistScenario, type ScenarioRow } from '@/server/test-lab/execution'
import { loadVersionRuntime } from '@/server/test-lab/runtime'

type ActionResult = { ok: true; message: string } | { ok: false; error: string; refresh?: boolean }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

function notificationBucket() {
  return Math.floor(Date.now() / (15 * 60 * 1000))
}

const createScenarioSchema = z.object({
  versionId: z.string().min(1),
  name: z.string().trim().min(3, 'اكتب اسمًا واضحًا للسيناريو.').max(120),
  category: z.enum(SCENARIO_CATEGORIES),
  isCritical: z.boolean(),
  input: scenarioInputSchema,
  expectation: scenarioExpectationSchema,
})

const updateScenarioSchema = createScenarioSchema.omit({ versionId: true }).extend({
  scenarioId: z.string().min(1),
})

const runVersionSchema = z.string().min(1)

async function recordAudit(input: {
  workspaceId: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  note: string
}) {
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: { note: input.note },
    createdAt: new Date(),
  })
}

export async function createTestScenario(
  input: z.input<typeof createScenarioSchema>,
): Promise<ActionResult> {
  const access = await authorizeOperator('test.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة الاختبارات.' }

  const parsed = createScenarioSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات السيناريو غير مكتملة.' }
  }

  const [version] = await db
    .select({
      id: agentVersion.id,
      status: agentVersion.status,
      versionNumber: agentVersion.versionNumber,
      workspaceId: agent.workspaceId,
      agentName: agent.name,
    })
    .from(agentVersion)
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(eq(agentVersion.id, parsed.data.versionId))
    .limit(1)

  if (!version || version.status === 'archived') {
    return { ok: false, error: 'النسخة غير موجودة أو لم تعد قابلة للاختبار.' }
  }

  const scenarioId = id('scenario')
  await db.insert(scenarioTest).values({
    id: scenarioId,
    agentVersionId: version.id,
    name: parsed.data.name,
    category: parsed.data.category,
    input: parsed.data.input,
    expectedOutcome: parsed.data.expectation,
    isCritical: parsed.data.isCritical,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await recordAudit({
    workspaceId: version.workspaceId,
    actorId: access.userId,
    action: 'test.scenario_created',
    resourceType: 'scenario_test',
    resourceId: scenarioId,
    note: `إضافة سيناريو «${parsed.data.name}» إلى ${version.agentName} v${version.versionNumber}`,
  })

  revalidatePath('/console/test-lab')
  return { ok: true, message: 'أُضيف السيناريو. شغّله لتحديث قرار النشر.' }
}

export async function updateTestScenario(
  input: z.input<typeof updateScenarioSchema>,
): Promise<ActionResult> {
  const access = await authorizeOperator('test.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة الاختبارات.' }

  const parsed = updateScenarioSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات السيناريو غير مكتملة.' }
  }

  const [row] = await db
    .select({
      id: scenarioTest.id,
      previousName: scenarioTest.name,
      versionStatus: agentVersion.status,
      versionNumber: agentVersion.versionNumber,
      workspaceId: agent.workspaceId,
      agentName: agent.name,
    })
    .from(scenarioTest)
    .innerJoin(agentVersion, eq(scenarioTest.agentVersionId, agentVersion.id))
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(eq(scenarioTest.id, parsed.data.scenarioId))
    .limit(1)

  if (!row || row.versionStatus === 'archived') {
    return { ok: false, error: 'السيناريو غير موجود أو لم يعد قابلًا للتعديل.' }
  }

  await db
    .update(scenarioTest)
    .set({
      name: parsed.data.name,
      category: parsed.data.category,
      input: parsed.data.input,
      expectedOutcome: parsed.data.expectation,
      isCritical: parsed.data.isCritical,
      updatedAt: new Date(),
    })
    .where(eq(scenarioTest.id, row.id))

  await recordAudit({
    workspaceId: row.workspaceId,
    actorId: access.userId,
    action: 'test.scenario_updated',
    resourceType: 'scenario_test',
    resourceId: row.id,
    note: `تعديل سيناريو «${row.previousName}» في ${row.agentName} v${row.versionNumber}؛ يلزم تشغيله مجددًا`,
  })

  revalidatePath('/console/test-lab')
  revalidatePath('/console/agents')
  return { ok: true, message: 'حُدّث السيناريو. أعد تشغيله لتجديد دليل النشر.' }
}

export async function deleteTestScenario(scenarioId: string): Promise<ActionResult> {
  const access = await authorizeOperator('test.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة الاختبارات.' }

  const parsedId = z.string().min(1).safeParse(scenarioId)
  if (!parsedId.success) return { ok: false, error: 'السيناريو غير صالح.' }

  const [row] = await db
    .select({
      id: scenarioTest.id,
      name: scenarioTest.name,
      workspaceId: agent.workspaceId,
    })
    .from(scenarioTest)
    .innerJoin(agentVersion, eq(scenarioTest.agentVersionId, agentVersion.id))
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(eq(scenarioTest.id, parsedId.data))
    .limit(1)

  if (!row) return { ok: false, error: 'السيناريو غير موجود.' }

  await db.delete(scenarioTest).where(eq(scenarioTest.id, row.id))
  await recordAudit({
    workspaceId: row.workspaceId,
    actorId: access.userId,
    action: 'test.scenario_deleted',
    resourceType: 'scenario_test',
    resourceId: row.id,
    note: `حذف سيناريو «${row.name}» ونتائجه`,
  })

  revalidatePath('/console/test-lab')
  return { ok: true, message: 'حُذف السيناريو ونتائجه السابقة.' }
}

async function scenarioWithVersion(scenarioId: string) {
  const [row] = await db
    .select({ scenario: scenarioTest, workspaceId: agent.workspaceId })
    .from(scenarioTest)
    .innerJoin(agentVersion, eq(scenarioTest.agentVersionId, agentVersion.id))
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .where(eq(scenarioTest.id, scenarioId))
    .limit(1)
  return row ?? null
}

export async function runTestScenario(scenarioId: string): Promise<ActionResult> {
  const access = await authorizeOperator('test.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية تشغيل الاختبارات.' }
  const limited = limitAction('test_scenario', access.userId)
  if (limited) return limited

  const row = await scenarioWithVersion(scenarioId)
  if (!row) return { ok: false, error: 'السيناريو غير موجود.' }

  const runtime = await loadVersionRuntime(row.scenario.agentVersionId)
  if (!runtime) return { ok: false, error: 'تعذّر تحميل النسخة المطلوبة للاختبار.' }

  const result = await executeAndPersistScenario(runtime, row.scenario)
  await recordAudit({
    workspaceId: row.workspaceId,
    actorId: access.userId,
    action: 'test.scenario_run',
    resourceType: 'scenario_test',
    resourceId: row.scenario.id,
    note: `${result.passed ? 'نجح' : 'لم ينجح'} سيناريو «${row.scenario.name}» بدرجة ${result.score}`,
  })

  if (!result.passed && row.scenario.isCritical) {
    await tryNotify(() =>
      notifyOperators({
        workspaceId: row.workspaceId,
        roles: ['owner', 'ops', 'qa'],
        severity: 'critical',
        category: 'qa',
        title: 'سيناريو حرج لم ينجح',
        message: `${runtime.workspaceName} — ${row.scenario.name}`,
        href: `/console/test-lab?version=${runtime.versionId}`,
        sourceType: 'scenario_test',
        sourceId: row.scenario.id,
        dedupeKey: `scenario-failed:${row.scenario.id}:${result.details.reasonCode ?? 'failed'}:${notificationBucket()}`,
      }),
    )
  }

  revalidatePath('/console/test-lab')
  revalidatePath('/console/agents')
  return result.passed
    ? { ok: true, message: `نجح السيناريو بدرجة ${result.score}%.` }
    : {
        ok: false,
        error:
          result.details.errorMessage ?? `النتيجة ${result.score}%. راجع الفحوص الفاشلة قبل النشر.`,
        refresh: true,
      }
}

export async function runVersionTestSuite(versionId: string): Promise<ActionResult> {
  const access = await authorizeOperator('test.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية تشغيل الاختبارات.' }
  // A batch opens one Realtime session per scenario, up to twelve.
  const limited = limitAction('test_suite', access.userId)
  if (limited) return limited

  const parsed = runVersionSchema.safeParse(versionId)
  if (!parsed.success) return { ok: false, error: 'النسخة غير صالحة.' }

  const runtime = await loadVersionRuntime(parsed.data)
  if (!runtime) return { ok: false, error: 'تعذّر تحميل النسخة المطلوبة للاختبار.' }

  const scenarios = await db
    .select()
    .from(scenarioTest)
    .where(eq(scenarioTest.agentVersionId, runtime.versionId))
    .orderBy(scenarioTest.createdAt)

  if (scenarios.length === 0) return { ok: false, error: 'أضف سيناريو واحدًا على الأقل أولًا.' }
  if (scenarios.length > 12) {
    return {
      ok: false,
      error: 'التشغيل التفاعلي يدعم 12 سيناريو في الدفعة. قسّم الحزمة قبل تشغيلها.',
    }
  }

  // Sequential, not the two-worker pool this used to run: this process caps
  // its heap well below the container limit (package.json#start) and owns
  // every live call's sideband socket at the same time, so two scenarios'
  // realtime WS sessions overlapping was extra memory pressure this had no
  // real need for. A batch takes longer now; nothing else about the result
  // changes.
  const results: {
    scenario: ScenarioRow
    result: Awaited<ReturnType<typeof executeAndPersistScenario>>
  }[] = []
  for (const scenario of scenarios) {
    results.push({ scenario, result: await executeAndPersistScenario(runtime, scenario) })
  }

  const failed = results.filter(({ result }) => !result.passed).length
  const criticalFailed = results.filter(
    ({ scenario, result }) => scenario.isCritical && !result.passed,
  ).length

  await recordAudit({
    workspaceId: runtime.workspaceId,
    actorId: access.userId,
    action: 'test.suite_run',
    resourceType: 'agent_version',
    resourceId: runtime.versionId,
    note: `تشغيل ${results.length} سيناريو — ${results.length - failed} ناجح، ${failed} يحتاج معالجة`,
  })

  if (criticalFailed > 0) {
    await tryNotify(() =>
      notifyOperators({
        workspaceId: runtime.workspaceId,
        roles: ['owner', 'ops', 'qa'],
        severity: 'critical',
        category: 'qa',
        title: 'حزمة الاختبار تمنع النشر',
        message: `${runtime.workspaceName} — ${criticalFailed} سيناريو حرج يحتاج معالجة`,
        href: `/console/test-lab?version=${runtime.versionId}`,
        sourceType: 'agent_version',
        sourceId: runtime.versionId,
        dedupeKey: `suite-critical:${runtime.versionId}:${criticalFailed}:${notificationBucket()}`,
      }),
    )
  }

  revalidatePath('/console/test-lab')
  revalidatePath('/console/agents')
  return failed === 0
    ? { ok: true, message: `نجحت الحزمة كاملة: ${results.length} من ${results.length}.` }
    : {
        ok: false,
        error: `اكتمل التشغيل: ${results.length - failed} ناجح و${failed} يحتاج معالجة.`,
        refresh: true,
      }
}
