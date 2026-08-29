import 'server-only'

import { desc, eq, ne } from 'drizzle-orm'
import {
  parseScenarioExpectation,
  parseScenarioInput,
  scenarioRunDetailsSchema,
} from '@/lib/test-lab'
import { db } from '@/server/db'
import { agent, agentVersion, scenarioRun, scenarioTest, workspace } from '@/server/db/schema'
import { getVersionTestGate } from '@/server/test-lab/gate'

export async function getTestLab(requestedVersionId?: string) {
  const versions = await db
    .select({
      id: agentVersion.id,
      versionNumber: agentVersion.versionNumber,
      status: agentVersion.status,
      updatedAt: agentVersion.updatedAt,
      agentId: agent.id,
      agentName: agent.name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    })
    .from(agentVersion)
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
    .where(ne(agentVersion.status, 'archived'))
    .orderBy(workspace.name, agent.name, desc(agentVersion.versionNumber))

  const selected =
    versions.find((version) => version.id === requestedVersionId) ??
    versions.find((version) => version.status === 'draft' || version.status === 'review') ??
    versions[0] ??
    null

  if (!selected) {
    return {
      versions,
      selected: null,
      scenarios: [],
      gate: null,
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    }
  }

  const [tests, runs, gate] = await Promise.all([
    db
      .select()
      .from(scenarioTest)
      .where(eq(scenarioTest.agentVersionId, selected.id))
      .orderBy(scenarioTest.createdAt),
    db
      .select()
      .from(scenarioRun)
      .where(eq(scenarioRun.agentVersionId, selected.id))
      .orderBy(desc(scenarioRun.ranAt)),
    getVersionTestGate(selected.id),
  ])

  const latestByScenario = new Map<string, (typeof runs)[number]>()
  for (const run of runs) {
    if (!latestByScenario.has(run.scenarioId)) latestByScenario.set(run.scenarioId, run)
  }

  const scenarios = tests.map((test) => {
    const latest = latestByScenario.get(test.id) ?? null
    const parsedDetails = latest ? scenarioRunDetailsSchema.safeParse(latest.details) : null
    return {
      ...test,
      inputContract: parseScenarioInput(test.input),
      expectationContract: parseScenarioExpectation(test.expectedOutcome),
      latestRun: latest
        ? {
            ...latest,
            details: parsedDetails?.success ? parsedDetails.data : null,
            trusted: parsedDetails?.success ?? false,
            fresh:
              latest.ranAt >=
              new Date(Math.max(selected.updatedAt.getTime(), test.updatedAt.getTime())),
          }
        : null,
    }
  })

  return {
    versions,
    selected,
    scenarios,
    gate,
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
  }
}
