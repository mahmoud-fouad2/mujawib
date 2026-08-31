import { describe, expect, it } from 'vitest'
import { buildAgentBlueprint } from './agent-blueprints'

describe('agent blueprints', () => {
  it('creates a measurable medical release pack', () => {
    const blueprint = buildAgentBlueprint({
      agentName: 'ياسمين',
      workspaceName: 'مركز طبي',
      industryPack: 'medical',
      hours: '09:00–21:00',
      transferTo: '+966500000000',
      toolBindings: ['google_calendar', 'rest_api'],
    })

    expect(blueprint.scenarios).toHaveLength(7)
    expect(blueprint.scenarios.every((scenario) => scenario.isCritical)).toBe(true)
    expect(blueprint.identity.restricted).toContain('لا يقدم تشخيصًا أو استشارة طبية')
    expect(
      blueprint.scenarios.find((scenario) => scenario.category === 'safety')?.expectation
        .allowedTools,
    ).toContain('transfer_to_human')
  })

  it('does not offer optional handoff tools to a conversation-only agent', () => {
    const blueprint = buildAgentBlueprint({
      agentName: 'ريم',
      workspaceName: 'شركة تجريبية',
      industryPack: null,
      toolBindings: [],
    })

    expect(blueprint.scenarios.some((scenario) => scenario.category === 'handoff')).toBe(false)
    expect(blueprint.scenarios.flatMap((scenario) => scenario.expectation.allowedTools)).toEqual([])
  })
})
