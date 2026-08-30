import { z } from 'zod'

export const SCENARIO_CATEGORIES = [
  'opening',
  'knowledge',
  'booking',
  'handoff',
  'safety',
  'adversarial',
] as const

export const SCENARIO_CATEGORY_LABEL: Record<(typeof SCENARIO_CATEGORIES)[number], string> = {
  opening: 'بداية المكالمة',
  knowledge: 'المعرفة',
  booking: 'الحجز والإجراءات',
  handoff: 'التحويل والتصعيد',
  safety: 'السلامة',
  adversarial: 'الضغط والحالات المربكة',
}

export const TESTABLE_TOOL_NAMES = [
  'check_availability',
  'create_booking',
  'send_confirmation',
  'create_callback',
  'transfer_to_human',
] as const

export const scenarioInputSchema = z.object({
  turns: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
})

export const scenarioExpectationSchema = z
  .object({
    mustIncludeAny: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    mustIncludeAll: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    mustNotInclude: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    expectedTool: z.enum(TESTABLE_TOOL_NAMES).nullable().default(null),
    allowedTools: z.array(z.enum(TESTABLE_TOOL_NAMES)).max(5).default([]),
    forbiddenTools: z.array(z.enum(TESTABLE_TOOL_NAMES)).max(5).default([]),
    language: z.enum(['ar', 'en']).nullable().default(null),
    maxWords: z.number().int().min(3).max(120).nullable().default(null),
  })
  .refine(
    (value) =>
      value.mustIncludeAny.length > 0 ||
      value.mustIncludeAll.length > 0 ||
      value.mustNotInclude.length > 0 ||
      value.expectedTool !== null ||
      value.allowedTools.length > 0 ||
      value.forbiddenTools.length > 0 ||
      value.language !== null ||
      value.maxWords !== null,
    { message: 'أضف نتيجة متوقعة واحدة على الأقل.' },
  )
  .superRefine((value, context) => {
    const contradictions = value.allowedTools.filter((tool) => value.forbiddenTools.includes(tool))
    if (value.expectedTool && value.forbiddenTools.includes(value.expectedTool)) {
      contradictions.push(value.expectedTool)
    }
    if (contradictions.length) {
      context.addIssue({
        code: 'custom',
        path: ['forbiddenTools'],
        message: `لا يمكن السماح بالإجراء ومنعه في السيناريو نفسه: ${[
          ...new Set(contradictions),
        ].join('، ')}`,
      })
    }
  })

export type ScenarioInput = z.infer<typeof scenarioInputSchema>
export type ScenarioExpectation = z.infer<typeof scenarioExpectationSchema>

export type TestLabTranscriptTurn = {
  role: 'caller' | 'agent'
  text: string
}

export type TestLabToolCall = {
  name: string
  argumentsJson: string
}

type TestLabCheck = {
  id: string
  label: string
  passed: boolean
  evidence: string | null
}

export const scenarioRunDetailsSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(['passed', 'failed', 'error']),
  runner: z.literal('openai-realtime-text'),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  transcript: z.array(
    z.object({
      role: z.enum(['caller', 'agent']),
      text: z.string(),
    }),
  ),
  toolCalls: z.array(
    z.object({
      name: z.string(),
      argumentsJson: z.string(),
    }),
  ),
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      passed: z.boolean(),
      evidence: z.string().nullable(),
    }),
  ),
  reasonCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
})

export type ScenarioRunDetails = z.infer<typeof scenarioRunDetailsSchema>

function normalizeArabic(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function hasPhrase(haystack: string, needle: string) {
  return normalizeArabic(haystack).includes(normalizeArabic(needle))
}

function evidence(value: string) {
  return value.length > 180 ? `${value.slice(0, 177)}...` : value
}

export function parseScenarioInput(value: unknown): ScenarioInput | null {
  const direct = scenarioInputSchema.safeParse(value)
  if (direct.success) return direct.data

  const legacy = z.object({ utterance: z.string().trim().min(1).max(500) }).safeParse(value)
  return legacy.success ? { turns: [legacy.data.utterance] } : null
}

export function parseScenarioExpectation(value: unknown): ScenarioExpectation | null {
  const parsed = scenarioExpectationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function evaluateScenario(input: {
  expectation: ScenarioExpectation
  transcript: TestLabTranscriptTurn[]
  toolCalls: TestLabToolCall[]
}) {
  const agentText = input.transcript
    .filter((turn) => turn.role === 'agent')
    .map((turn) => turn.text)
    .join(' ')
  const toolNames = input.toolCalls.map((call) => call.name)
  const checks: TestLabCheck[] = []

  checks.push({
    id: 'produced_outcome',
    label: 'أنتج ردًا أو طلب إجراء واضحًا',
    passed: Boolean(agentText.trim() || toolNames.length),
    evidence: agentText.trim() ? evidence(agentText) : toolNames.join('، ') || null,
  })

  if (input.expectation.mustIncludeAny.length) {
    const found = input.expectation.mustIncludeAny.find((phrase) => hasPhrase(agentText, phrase))
    checks.push({
      id: 'must_include_any',
      label: `يتضمن واحدًا من: ${input.expectation.mustIncludeAny.join('، ')}`,
      passed: Boolean(found),
      evidence: found ?? null,
    })
  }

  for (const [index, phrase] of input.expectation.mustIncludeAll.entries()) {
    checks.push({
      id: `must_include_all_${index}`,
      label: `يتضمن: ${phrase}`,
      passed: hasPhrase(agentText, phrase),
      evidence: hasPhrase(agentText, phrase) ? phrase : null,
    })
  }

  for (const [index, phrase] of input.expectation.mustNotInclude.entries()) {
    const found = hasPhrase(agentText, phrase)
    checks.push({
      id: `must_not_include_${index}`,
      label: `لا يقول: ${phrase}`,
      passed: !found,
      evidence: found ? phrase : null,
    })
  }

  if (input.expectation.expectedTool) {
    checks.push({
      id: 'expected_tool',
      label: `يطلب الإجراء: ${input.expectation.expectedTool}`,
      passed: toolNames.includes(input.expectation.expectedTool),
      evidence: toolNames.length ? toolNames.join('، ') : null,
    })
  } else {
    const unexpectedTools = toolNames.filter(
      (toolName) =>
        !input.expectation.allowedTools.includes(toolName as (typeof TESTABLE_TOOL_NAMES)[number]),
    )
    checks.push({
      id: 'no_unexpected_tool',
      label: 'لا يطلب إجراءً غير متوقع',
      passed: unexpectedTools.length === 0,
      evidence: unexpectedTools.length ? unexpectedTools.join('، ') : null,
    })
  }

  for (const toolName of input.expectation.forbiddenTools) {
    checks.push({
      id: `forbidden_tool_${toolName}`,
      label: `لا يطلب الإجراء: ${toolName}`,
      passed: !toolNames.includes(toolName),
      evidence: toolNames.includes(toolName) ? toolName : null,
    })
  }

  if (input.expectation.language && agentText.trim()) {
    const letters = [...agentText].filter((char) => /\p{L}/u.test(char))
    const arabic = letters.filter((char) => /\p{Script=Arabic}/u.test(char)).length
    const arabicRatio = letters.length ? arabic / letters.length : 0
    const passed = input.expectation.language === 'ar' ? arabicRatio >= 0.55 : arabicRatio < 0.35
    checks.push({
      id: 'language',
      label: input.expectation.language === 'ar' ? 'يرد بالعربية' : 'يرد بالإنجليزية',
      passed,
      evidence: agentText.trim() ? `${Math.round(arabicRatio * 100)}% حروف عربية` : null,
    })
  }

  if (input.expectation.maxWords !== null && agentText.trim()) {
    const wordCount = agentText.trim() ? agentText.trim().split(/\s+/).length : 0
    checks.push({
      id: 'max_words',
      label: `لا يتجاوز ${input.expectation.maxWords} كلمة`,
      passed: wordCount > 0 && wordCount <= input.expectation.maxWords,
      evidence: `${wordCount} كلمة`,
    })
  }

  const passedChecks = checks.filter((check) => check.passed).length
  return {
    passed: passedChecks === checks.length,
    score: Math.round((passedChecks / checks.length) * 100),
    checks,
  }
}

export type GateRun = {
  passed: boolean
  ranAt: Date
  details: unknown
}

export type GateScenario = {
  id: string
  name: string
  isCritical: boolean
  updatedAt: Date
  latestRun: GateRun | null
}

export function assessVersionTestGate(versionUpdatedAt: Date, scenarios: GateScenario[]) {
  const missing = scenarios.filter((scenario) => !scenario.latestRun)
  const invalid = scenarios.filter(
    (scenario) =>
      scenario.latestRun && !scenarioRunDetailsSchema.safeParse(scenario.latestRun.details).success,
  )
  const stale = scenarios.filter(
    (scenario) =>
      scenario.latestRun &&
      scenario.latestRun.ranAt <
        new Date(Math.max(versionUpdatedAt.getTime(), scenario.updatedAt.getTime())),
  )
  const criticalFailed = scenarios.filter(
    (scenario) => scenario.isCritical && scenario.latestRun?.passed !== true,
  )
  const nonCriticalFailed = scenarios.filter(
    (scenario) => !scenario.isCritical && scenario.latestRun?.passed === false,
  )

  const blockers: string[] = []
  if (scenarios.length === 0) blockers.push('لا توجد سيناريوهات اختبار لهذه النسخة.')
  if (missing.length) blockers.push(`${missing.length} سيناريو لم يُشغّل بعد.`)
  if (invalid.length) blockers.push(`${invalid.length} نتيجة قديمة لا تعتمد على المشغّل الفعلي.`)
  if (stale.length) blockers.push(`${stale.length} نتيجة أقدم من آخر تعديل للنسخة أو السيناريو.`)
  if (criticalFailed.length)
    blockers.push(`سيناريو حرج لم ينجح: ${criticalFailed[0]?.name ?? 'غير معروف'}.`)

  const trustedRuns = scenarios.filter(
    (scenario) =>
      scenario.latestRun &&
      scenarioRunDetailsSchema.safeParse(scenario.latestRun.details).success &&
      scenario.latestRun.ranAt >=
        new Date(Math.max(versionUpdatedAt.getTime(), scenario.updatedAt.getTime())),
  )

  return {
    canPublish: blockers.length === 0,
    blockers,
    total: scenarios.length,
    fresh: trustedRuns.length,
    passed: trustedRuns.filter((scenario) => scenario.latestRun?.passed === true).length,
    criticalFailed: criticalFailed.length,
    nonCriticalFailed: nonCriticalFailed.length,
  }
}
