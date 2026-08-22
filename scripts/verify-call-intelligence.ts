import {
  generatedCallSummarySchema,
  parseCallSummaryResponse,
  readCallIntelligenceState,
} from '../lib/call-intelligence.ts'

let failures = 0

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  OK ${label}`)
    return
  }
  failures += 1
  console.error(`  FAIL ${label}`)
}

console.log('Post-call intelligence contract')

const summary = {
  headline: 'يحتاج المتصل متابعة موعده',
  callerNeed: 'التحقق من موعد العيادة',
  resolution: 'تم شرح المواعيد المتاحة دون إنشاء حجز.',
  nextAction: 'يتواصل الفريق لتأكيد الموعد المناسب.',
  intent: 'متابعة موعد',
  urgency: 'medium',
  followUpRequired: true,
} as const

const parsed = parseCallSummaryResponse({
  id: 'resp_test',
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(summary) }],
    },
  ],
  usage: { input_tokens: 120, output_tokens: 40 },
})

check('valid structured response is accepted', parsed.ok)
check('token usage is normalized', parsed.ok && parsed.usage?.inputTokens === 120)
check(
  'business wording survives validation',
  parsed.ok && parsed.summary.headline === summary.headline,
)

check(
  'unknown summary fields are rejected',
  !generatedCallSummarySchema.safeParse({ ...summary, fabricatedOutcome: 'booking' }).success,
)
check(
  'refusal is handled explicitly',
  parseCallSummaryResponse({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }],
  }).ok === false,
)
check(
  'incomplete API response is not persisted',
  parseCallSummaryResponse({ status: 'in_progress', output: [] }).ok === false,
)

const state = readCallIntelligenceState({
  postCall: {
    schemaVersion: 1,
    state: 'completed',
    model: 'gpt-5.4-mini-2026-03-17',
    transcriptHash: 'a'.repeat(64),
    attempt: 1,
    generatedAt: new Date().toISOString(),
    responseId: 'resp_test',
    usage: { inputTokens: 120, outputTokens: 40 },
  },
})
check('trusted processing metadata is readable', state.state === 'completed')
check(
  'malformed processing metadata fails closed',
  readCallIntelligenceState({ postCall: { state: 'completed' } }).state === 'not_started',
)

if (failures > 0) process.exit(1)
console.log('\nAll post-call intelligence checks passed')
