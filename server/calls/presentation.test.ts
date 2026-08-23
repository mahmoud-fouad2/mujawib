import { describe, expect, it } from 'vitest'
import { CALL_STATUS_LABEL, duration, statusTone } from '../../lib/format'
import { buildCallSummary, normalizeTranscript } from './presentation'

describe('normalizeTranscript', () => {
  it('normalizes provider roles and drops turns that should not render', () => {
    const transcript = normalizeTranscript([
      { role: 'user', transcript: 'أحتاج موعدًا غدًا', offset_ms: 1200 },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'سأتحقق من المواعيد المتاحة.' }],
        at: 3,
      },
      { role: 'system', text: 'must not render', at: 0 },
      null,
    ])

    expect(transcript).toEqual([
      { role: 'caller', text: 'أحتاج موعدًا غدًا', at: 1.2 },
      { role: 'agent', text: 'سأتحقق من المواعيد المتاحة.', at: 3 },
    ])
  })
})

describe('buildCallSummary', () => {
  const transcript = normalizeTranscript([
    { role: 'user', transcript: 'أحتاج موعدًا غدًا', offset_ms: 1200 },
    { role: 'assistant', content: [{ type: 'text', text: 'سأتحقق من المواعيد المتاحة.' }], at: 3 },
  ])

  it('does not claim a booking without a booking record', () => {
    const summary = buildCallSummary({
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
    expect(summary.headline).toBe('نتيجة الحجز تحتاج تحققًا')
    expect(summary.callerHighlights).toEqual(['أحتاج موعدًا غدًا'])
  })

  it('leaves an open call pending rather than guessing an outcome', () => {
    const summary = buildCallSummary({
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
    expect(summary.source).toBe('pending')
    expect(summary.warnings[0]).toBe('نص الحوار غير متاح لهذه المكالمة.')
  })

  it('prefers a recorded post-call summary over a generated one', () => {
    const summary = buildCallSummary({
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
    expect(summary.source).toBe('recorded')
    expect(summary.urgency).toBe('medium')
    expect(summary.followUpRequired).toBe(true)
  })

  /**
   * The regression these three guard against: every real call on the
   * platform showed as "فشلت" with a forty-hour duration, because the
   * stale-call sweep closed anything still `live` after four hours as failed
   * and wrote `now - startedAt` as the duration. The telephony path was
   * working — the caller reached the agent — only the bookkeeping was
   * missing. Collapsing "answered but unrecorded" into the same status as
   * "the caller heard nothing" is what hid that distinction.
   */
  it('does not report an answered call with no transcript as a failure', () => {
    const summary = buildCallSummary({
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
    expect(summary.headline).toBe('تم استقبال المكالمة والرد عليها')
    expect(summary.warnings[0]).toBe('المكالمة تم قبولها وتسجيلها، لكن نص الحوار غير متاح بعد.')
  })

  it('names an accept failure as the caller hearing nothing', () => {
    const summary = buildCallSummary({
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
    expect(summary.headline).toBe('لم تُقبل المكالمة')
  })

  it('names a route failure as an unrecognised number', () => {
    const summary = buildCallSummary({
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
    expect(summary.headline).toBe('لم يُعرف الرقم المطلوب')
  })
})

describe('statusTone', () => {
  it('paints an incomplete record amber, not red — it is a gap in the record, not an outage', () => {
    expect(statusTone('completed_no_transcript')).toBe('warn')
  })

  it('reserves red for calls the caller never heard', () => {
    expect(statusTone('accept_failed')).toBe('bad')
    expect(statusTone('route_failed')).toBe('bad')
  })

  it('keeps a clean call green', () => {
    expect(statusTone('completed')).toBe('good')
  })
})

describe('CALL_STATUS_LABEL', () => {
  it.each([
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
  ])('has an Arabic label for every status the database can hold: %s', (status) => {
    expect(typeof CALL_STATUS_LABEL[status]).toBe('string')
  })
})

describe('duration', () => {
  it('renders an unknown duration as a dash rather than inventing one', () => {
    // The other half of the bug above: a duration the sweep invented instead
    // of measured. Unknown must render as unknown.
    expect(duration(null)).toBe('—')
  })
})
