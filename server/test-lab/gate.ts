import 'server-only'

import { desc, eq, inArray } from 'drizzle-orm'
import { assessVersionTestGate, type GateRun, type GateScenario } from '@/lib/test-lab'
import { db } from '@/server/db'
import { agentVersion, scenarioRun, scenarioTest } from '@/server/db/schema'

export async function getVersionTestGate(versionId: string) {
  const [version] = await db
    .select({ id: agentVersion.id, updatedAt: agentVersion.updatedAt })
    .from(agentVersion)
    .where(eq(agentVersion.id, versionId))
    .limit(1)

  if (!version) return null

  const [tests, runs] = await Promise.all([
    db
      .select({
        id: scenarioTest.id,
        name: scenarioTest.name,
        isCritical: scenarioTest.isCritical,
      })
      .from(scenarioTest)
      .where(eq(scenarioTest.agentVersionId, versionId))
      .orderBy(scenarioTest.createdAt),
    db
      .select({
        scenarioId: scenarioRun.scenarioId,
        passed: scenarioRun.passed,
        ranAt: scenarioRun.ranAt,
        details: scenarioRun.details,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.agentVersionId, versionId))
      .orderBy(desc(scenarioRun.ranAt)),
  ])

  const latestByScenario = new Map<string, GateRun>()
  for (const run of runs) {
    if (!latestByScenario.has(run.scenarioId)) {
      latestByScenario.set(run.scenarioId, {
        passed: run.passed,
        ranAt: run.ranAt,
        details: run.details,
      })
    }
  }

  const scenarios: GateScenario[] = tests.map((test) => ({
    ...test,
    latestRun: latestByScenario.get(test.id) ?? null,
  }))

  return {
    version,
    scenarios,
    ...assessVersionTestGate(version.updatedAt, scenarios),
  }
}

export async function getVersionTestGates(versions: { id: string; updatedAt: Date }[]) {
  const result = new Map<string, Awaited<ReturnType<typeof getVersionTestGate>>>()
  if (versions.length === 0) return result

  const versionIds = versions.map((version) => version.id)
  const [tests, runs] = await Promise.all([
    db
      .select({
        id: scenarioTest.id,
        agentVersionId: scenarioTest.agentVersionId,
        name: scenarioTest.name,
        isCritical: scenarioTest.isCritical,
      })
      .from(scenarioTest)
      .where(inArray(scenarioTest.agentVersionId, versionIds)),
    db
      .select({
        agentVersionId: scenarioRun.agentVersionId,
        scenarioId: scenarioRun.scenarioId,
        passed: scenarioRun.passed,
        ranAt: scenarioRun.ranAt,
        details: scenarioRun.details,
      })
      .from(scenarioRun)
      .where(inArray(scenarioRun.agentVersionId, versionIds))
      .orderBy(desc(scenarioRun.ranAt)),
  ])

  const latestByScenario = new Map<string, GateRun>()
  for (const run of runs) {
    if (!latestByScenario.has(run.scenarioId)) {
      latestByScenario.set(run.scenarioId, {
        passed: run.passed,
        ranAt: run.ranAt,
        details: run.details,
      })
    }
  }

  for (const version of versions) {
    const scenarios: GateScenario[] = tests
      .filter((test) => test.agentVersionId === version.id)
      .map((test) => ({
        id: test.id,
        name: test.name,
        isCritical: test.isCritical,
        latestRun: latestByScenario.get(test.id) ?? null,
      }))
    result.set(version.id, {
      version,
      scenarios,
      ...assessVersionTestGate(version.updatedAt, scenarios),
    })
  }

  return result
}
