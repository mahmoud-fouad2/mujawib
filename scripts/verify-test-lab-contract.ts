import assert from 'node:assert/strict'
import {
  assessVersionTestGate,
  evaluateScenario,
  parseScenarioExpectation,
  parseScenarioInput,
  type ScenarioExpectation,
  type ScenarioRunDetails,
} from '../lib/test-lab'

const expectation: ScenarioExpectation = {
  mustIncludeAny: ['لحظة أتحقق', 'دعني أتحقق'],
  mustIncludeAll: [],
  mustNotInclude: ['تم الحجز'],
  expectedTool: null,
  forbiddenTools: ['create_booking'],
  language: 'ar' as const,
  maxWords: 20,
}

const successful = evaluateScenario({
  expectation,
  transcript: [
    { role: 'caller', text: 'أبغى موعد بكرة' },
    { role: 'agent', text: 'أبشر، لحظة أتحقق لك من الموعد المناسب.' },
  ],
  toolCalls: [],
})
assert.equal(successful.passed, true)
assert.equal(successful.score, 100)

const hallucinated = evaluateScenario({
  expectation,
  transcript: [
    { role: 'caller', text: 'أبغى موعد بكرة' },
    { role: 'agent', text: 'تم الحجز بكرة.' },
  ],
  toolCalls: [],
})
assert.equal(hallucinated.passed, false)

const toolRequest = evaluateScenario({
  expectation: {
    mustIncludeAny: [],
    mustIncludeAll: [],
    mustNotInclude: [],
    expectedTool: 'transfer_to_human',
    forbiddenTools: [],
    language: 'ar',
    maxWords: 20,
  },
  transcript: [{ role: 'caller', text: 'حولني لموظف' }],
  toolCalls: [{ name: 'transfer_to_human', argumentsJson: '{"reason":"requested"}' }],
})
assert.equal(toolRequest.passed, true)

assert.deepEqual(parseScenarioInput({ utterance: 'مرحبا' }), { turns: ['مرحبا'] })
assert.equal(parseScenarioExpectation({ pass: true }), null)

const now = new Date('2026-08-20T10:00:00.000Z')
const runDetails: ScenarioRunDetails = {
  schemaVersion: 1,
  status: 'passed',
  runner: 'openai-realtime-text',
  model: 'gpt-realtime-2.1',
  durationMs: 800,
  transcript: [],
  toolCalls: [],
  checks: [],
  reasonCode: null,
  errorMessage: null,
}

const ready = assessVersionTestGate(now, [
  {
    id: 'scenario_1',
    name: 'تحويل بشري',
    isCritical: true,
    latestRun: {
      passed: true,
      ranAt: new Date('2026-08-20T10:01:00.000Z'),
      details: runDetails,
    },
  },
])
assert.equal(ready.canPublish, true)

const stale = assessVersionTestGate(now, [
  {
    id: 'scenario_1',
    name: 'تحويل بشري',
    isCritical: true,
    latestRun: {
      passed: true,
      ranAt: new Date('2026-08-20T09:59:00.000Z'),
      details: runDetails,
    },
  },
])
assert.equal(stale.canPublish, false)
assert.match(stale.blockers.join(' '), /أقدم من آخر تعديل/)

const legacy = assessVersionTestGate(now, [
  {
    id: 'scenario_1',
    name: 'تحويل بشري',
    isCritical: true,
    latestRun: {
      passed: true,
      ranAt: new Date('2026-08-20T10:01:00.000Z'),
      details: {},
    },
  },
])
assert.equal(legacy.canPublish, false)
assert.match(legacy.blockers.join(' '), /نتيجة قديمة/)

const empty = assessVersionTestGate(now, [])
assert.equal(empty.canPublish, false)

console.log('Test Lab contract: PASS')
