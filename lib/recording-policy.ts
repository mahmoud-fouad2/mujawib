export const RECORDING_DISCLOSURE_MODES = ['none', 'agent_intro', 'external'] as const

export type WorkspaceRecordingPolicy = {
  enabled: boolean
  disclosureMode: string
  approvedAt: Date | null
}

export function recordingPolicyAllowsCapture(policy: WorkspaceRecordingPolicy) {
  return (
    policy.enabled &&
    policy.approvedAt !== null &&
    (policy.disclosureMode === 'agent_intro' || policy.disclosureMode === 'external')
  )
}

export function recordingDisclosureInstruction(mode: string) {
  if (mode !== 'agent_intro') return null
  return 'نبّه المتصل في بداية المكالمة بعبارة موجزة أن: «المكالمة مسجلة لضمان جودة الخدمة»، ثم تابع تقديم الخدمة فوراً دون سؤاله هل يوافق ودون انتظار إقرار.'
}
