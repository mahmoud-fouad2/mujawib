import { CALL_STATUS_LABEL, duration, statusTone } from '../lib/format.ts'
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

/* ─── an accepted call is never reported as a failure ────────────────────── */

/**
 * The regression these guard against: every real call on the platform showed
 * as "فشلت" with a forty-hour duration, because the stale-call sweep closed
 * anything still `live` after four hours as failed and wrote
 * `now - startedAt` as the duration. The telephony path was working; only the
 * bookkeeping was missing.
 */
const answered = buildCallSummary({
  status: 'completed_no_transcript',
  outcome: null,
  intent: null,
  endedAt: new Date(),
  metadata: {},
  transcript: [],
  booking: null,
  lead: null,
  tools: [],
})

check(
  'an answered call without a transcript is not a failure',
  answered.headline,
  'تم استقبال المكالمة والرد عليها',
)
check(
  'the missing transcript is named as the gap',
  answered.warnings[0],
  'المكالمة تم قبولها وتسجيلها، لكن نص الحوار غير متاح بعد.',
)

const notAccepted = buildCallSummary({
  status: 'accept_failed',
  outcome: null,
  intent: null,
  endedAt: new Date(),
  metadata: {},
  transcript: [],
  booking: null,
  lead: null,
  tools: [],
})

check(
  'a call that was never accepted says the caller heard nothing',
  notAccepted.headline,
  'لم تُقبل المكالمة',
)

const unrouted = buildCallSummary({
  status: 'route_failed',
  outcome: null,
  intent: null,
  endedAt: new Date(),
  metadata: {},
  transcript: [],
  booking: null,
  lead: null,
  tools: [],
})

check('an unrouted call names the missing route', unrouted.headline, 'لم يُعرف الرقم المطلوب')

// Colour carries the same distinction: amber is an incomplete record, red is
// a caller who heard nothing. Collapsing them is what hid the difference.
check(
  'an incomplete record is not painted as an outage',
  statusTone('completed_no_transcript'),
  'warn',
)
check('a call the caller never heard is red', statusTone('accept_failed'), 'bad')
check('an unrouted call is red', statusTone('route_failed'), 'bad')
check('a clean call stays green', statusTone('completed'), 'good')

// Every status the database can hold must have an Arabic label; an unlabelled
// one falls through to the raw enum value in the UI.
for (const status of [
  'accepting',
  'ringing',
  'live',
  'waiting_tool',
  'transferred',
  'completed',
  'completed_no_transcript',
  'route_failed',
  'accept_failed',
  'failed',
  'abandoned',
]) {
  check(`"${status}" has an Arabic label`, typeof CALL_STATUS_LABEL[status], 'string')
}

// The impossible duration is the other half of the bug: a duration the sweep
// invented rather than measured. Unknown must render as unknown.
check('an unknown duration renders as a dash', duration(null), '—')

if (failures > 0) process.exit(1)
console.log('\nAll call presentation checks passed')
