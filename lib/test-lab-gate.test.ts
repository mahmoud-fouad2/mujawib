import { describe, expect, it } from 'vitest'
import { assessVersionTestGate, type GateScenario } from './test-lab'

const validDetails = {
  schemaVersion: 1 as const,
  status: 'passed' as const,
  runner: 'openai-realtime-text' as const,
  model: 'gpt-realtime',
  durationMs: 100,
  transcript: [{ role: 'agent' as const, text: 'مرحبًا' }],
  toolCalls: [],
  checks: [],
  reasonCode: null,
  errorMessage: null,
}

function scenario(input: Partial<GateScenario> = {}): GateScenario {
  return {
    id: 'scenario_1',
    name: 'سيناريو',
    isCritical: true,
    updatedAt: new Date('2026-08-29T10:00:00Z'),
    latestRun: {
      passed: true,
      ranAt: new Date('2026-08-29T10:01:00Z'),
      details: validDetails,
    },
    ...input,
  }
}

describe('Test Lab publishing gate', () => {
  it('accepts a trusted run newer than both version and scenario', () => {
    const result = assessVersionTestGate(new Date('2026-08-29T09:00:00Z'), [scenario()])
    expect(result.canPublish).toBe(true)
    expect(result.fresh).toBe(1)
  })

  it('invalidates a run when the scenario was edited afterwards', () => {
    const result = assessVersionTestGate(new Date('2026-08-29T09:00:00Z'), [
      scenario({ updatedAt: new Date('2026-08-29T10:02:00Z') }),
    ])
    expect(result.canPublish).toBe(false)
    expect(result.blockers).toContain('1 نتيجة أقدم من آخر تعديل للنسخة أو السيناريو.')
    expect(result.fresh).toBe(0)
  })
})
