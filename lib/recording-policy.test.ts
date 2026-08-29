import { describe, expect, it } from 'vitest'
import { recordingDisclosureInstruction, recordingPolicyAllowsCapture } from './recording-policy'

describe('workspace recording policy', () => {
  it('stays fail-closed until approval and a disclosure mode both exist', () => {
    expect(
      recordingPolicyAllowsCapture({
        enabled: true,
        disclosureMode: 'agent_intro',
        approvedAt: null,
      }),
    ).toBe(false)
    expect(
      recordingPolicyAllowsCapture({
        enabled: true,
        disclosureMode: 'none',
        approvedAt: new Date(),
      }),
    ).toBe(false)
  })

  it('allows approved agent and external disclosure policies', () => {
    for (const disclosureMode of ['agent_intro', 'external']) {
      expect(
        recordingPolicyAllowsCapture({ enabled: true, disclosureMode, approvedAt: new Date() }),
      ).toBe(true)
    }
  })

  it('adds an opening disclosure only when the agent owns the notice', () => {
    expect(recordingDisclosureInstruction('agent_intro')).toContain('مسجلة')
    expect(recordingDisclosureInstruction('external')).toBeNull()
  })
})
