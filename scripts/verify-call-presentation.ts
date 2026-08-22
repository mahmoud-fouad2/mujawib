import { buildCallSummary, normalizeTranscript } from '../server/calls/presentation.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  OK ${label}`)
    return
  }
  failures += 1
  console.error(
    `  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    received ${JSON.stringify(actual)}`,
  )
}

console.log('Call presentation')

const transcript = normalizeTranscript([
  { role: 'user', transcript: 'أحتاج موعدًا غدًا', offset_ms: 1200 },
  { role: 'assistant', content: [{ type: 'text', text: 'سأتحقق من المواعيد المتاحة.' }], at: 3 },
  { role: 'system', text: 'must not render', at: 0 },
  null,
])

check('provider roles are normalized', transcript, [
  { role: 'caller', text: 'أحتاج موعدًا غدًا', at: 1.2 },
  { role: 'agent', text: 'سأتحقق من المواعيد المتاحة.', at: 3 },
])

const unprovenBooking = buildCallSummary({
  status: 'completed',
  outcome: 'booking',
  intent: 'حجز موعد',
  endedAt: new Date(),
  metadata: {},
  transcript,
  booking: null,
  lead: null,
  tools: [],
})

check(
  'booking is not claimed without a record',
  unprovenBooking.headline,
  'نتيجة الحجز تحتاج تحققًا',
)
check('caller highlight uses actual words', unprovenBooking.callerHighlights, ['أحتاج موعدًا غدًا'])

const pending = buildCallSummary({
  status: 'live',
  outcome: null,
  intent: null,
  endedAt: null,
  metadata: {},
  transcript: [],
  booking: null,
  lead: null,
  tools: [],
})

check('an open call remains pending', pending.source, 'pending')
check('missing transcript is explicit', pending.warnings[0], 'نص الحوار غير متاح لهذه المكالمة.')

const generated = buildCallSummary({
  status: 'completed',
  outcome: null,
  intent: null,
  endedAt: new Date(),
  metadata: {
    summary: {
      headline: 'طلب يحتاج متابعة',
      callerNeed: 'تأكيد الموعد',
      resolution: 'تمت الإجابة عن الأسئلة دون تنفيذ حجز.',
      nextAction: 'يتواصل الفريق لتأكيد الموعد.',
      urgency: 'medium',
      followUpRequired: true,
    },
  },
  transcript,
  booking: null,
  lead: null,
  tools: [],
})

check('recorded summary is preferred', generated.source, 'recorded')
check('generated urgency is typed', generated.urgency, 'medium')
check('generated follow-up is exposed', generated.followUpRequired, true)

if (failures > 0) process.exit(1)
console.log('\nAll call presentation checks passed')
