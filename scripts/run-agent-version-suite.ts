import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { scenarioTest } from '@/server/db/schema'
import { executeAndPersistScenario } from '@/server/test-lab/execution'
import { loadVersionRuntime } from '@/server/test-lab/runtime'

const versionId = process.argv[2]?.trim()

if (!versionId) {
  throw new Error('Usage: pnpm test-lab:run-version <agent-version-id>')
}

const runtime = await loadVersionRuntime(versionId)
if (!runtime) {
  throw new Error(`Agent version ${versionId} was not found.`)
}

const scenarios = await db
  .select()
  .from(scenarioTest)
  .where(eq(scenarioTest.agentVersionId, runtime.versionId))
  .orderBy(scenarioTest.createdAt)

if (scenarios.length === 0) {
  throw new Error(`Agent version ${versionId} has no test scenarios.`)
}
if (scenarios.length > 12) {
  throw new Error('A single suite run is limited to 12 scenarios.')
}

console.log(`Running ${scenarios.length} persisted scenario(s) for ${runtime.versionId}.`)

let failed = 0
for (const scenario of scenarios) {
  const result = await executeAndPersistScenario(runtime, scenario)
  if (!result.passed) failed += 1

  console.log(
    JSON.stringify({
      scenarioId: scenario.id,
      name: scenario.name,
      passed: result.passed,
      score: result.score,
      model: result.details.model,
      durationMs: result.details.durationMs,
      reasonCode: result.details.reasonCode,
    }),
  )
}

console.log(
  JSON.stringify({
    versionId: runtime.versionId,
    total: scenarios.length,
    passed: scenarios.length - failed,
    failed,
  }),
)

if (failed > 0) process.exitCode = 1
