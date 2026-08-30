import 'server-only'

import { randomUUID } from 'node:crypto'
import {
  evaluateScenario,
  parseScenarioExpectation,
  parseScenarioInput,
  type ScenarioRunDetails,
} from '@/lib/test-lab'
import { db } from '@/server/db'
import { scenarioRun, type scenarioTest } from '@/server/db/schema'
import { runRealtimeScenario, type VersionRuntime } from '@/server/test-lab/runtime'
import { PRIMARY_REALTIME_MODEL } from '@/server/voice/model'

export type ScenarioRow = typeof scenarioTest.$inferSelect

function runId() {
  return `run_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

export async function executeAndPersistScenario(runtime: VersionRuntime, scenario: ScenarioRow) {
  const parsedInput = parseScenarioInput(scenario.input)
  const expectation = parseScenarioExpectation(scenario.expectedOutcome)
  let details: ScenarioRunDetails
  let passed = false
  let score = 0

  if (!parsedInput || !expectation) {
    details = {
      schemaVersion: 1,
      status: 'error',
      runner: 'openai-realtime-text',
      model: PRIMARY_REALTIME_MODEL,
      durationMs: 0,
      transcript: [],
      toolCalls: [],
      checks: [],
      reasonCode: 'invalid_scenario_contract',
      errorMessage: 'السيناريو قديم أو تنقصه نتيجة متوقعة قابلة للقياس.',
    }
  } else {
    const output = await runRealtimeScenario(runtime, parsedInput)
    if (!output.ok) {
      details = {
        schemaVersion: 1,
        status: 'error',
        runner: 'openai-realtime-text',
        model: output.model,
        durationMs: output.durationMs,
        transcript: output.transcript,
        toolCalls: output.toolCalls,
        checks: [],
        reasonCode: output.reasonCode,
        errorMessage: output.message,
      }
    } else {
      const evaluation = evaluateScenario({
        expectation,
        transcript: output.transcript,
        toolCalls: output.toolCalls,
      })
      passed = evaluation.passed
      score = evaluation.score
      details = {
        schemaVersion: 1,
        status: passed ? 'passed' : 'failed',
        runner: 'openai-realtime-text',
        model: output.model,
        durationMs: output.durationMs,
        transcript: output.transcript,
        toolCalls: output.toolCalls,
        checks: evaluation.checks,
        reasonCode: passed ? null : 'expectation_failed',
        errorMessage: null,
      }
    }
  }

  await db.insert(scenarioRun).values({
    id: runId(),
    agentVersionId: runtime.versionId,
    scenarioId: scenario.id,
    passed,
    score,
    details,
    ranAt: new Date(),
  })

  return { passed, score, details }
}
