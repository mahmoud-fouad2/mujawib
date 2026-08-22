import 'server-only'

import { desc, eq } from 'drizzle-orm'
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
