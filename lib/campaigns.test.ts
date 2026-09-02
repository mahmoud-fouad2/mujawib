import { describe, expect, it } from 'vitest'
import {
  allowedConcurrency,
  type CallingWindow,
  campaignReadiness,
  canAttempt,
  clampCallingWindow,
  DEFAULT_CALLING_WINDOW,
  DEFAULT_PACING,
  dispatchDecision,
  EARLIEST_CALL_MINUTE,
  importContacts,
  isReadyToSubmit,
  isWithinCallingWindow,
  LATEST_CALL_MINUTE,
  MAX_ATTEMPTS_PER_CONTACT,
  minuteToTime,
  nextWindowOpening,
  parseCsv,
  summarizeContacts,
  timeToMinute,
} from '@/lib/campaigns'

/** Riyadh (UTC+3) Monday 2026-09-07 at the given local hour. */
function riyadh(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, 7, hour - 3, minute))
}

const WINDOW: CallingWindow = {
  startMinute: 10 * 60,
  endMinute: 18 * 60,
  activeDays: [0, 1, 2, 3, 4],
  utcOffsetMinutes: 180,
}

describe('calling window', () => {
  it('refuses to honour a window outside decent hours', () => {
    // An operator typing 02:00–05:00 must not get 3am calls. Correcting is
    // better than rejecting: a rejected window leaves a campaign that never
    // dials and never says why.
    const clamped = clampCallingWindow({ ...WINDOW, startMinute: 2 * 60, endMinute: 5 * 60 })
    expect(clamped.startMinute).toBe(EARLIEST_CALL_MINUTE)
    expect(clamped.endMinute).toBeLessThanOrEqual(LATEST_CALL_MINUTE)
    expect(clamped.endMinute).toBeGreaterThan(clamped.startMinute)
  })

  it('never lets the end precede the start', () => {
    const clamped = clampCallingWindow({ ...WINDOW, startMinute: 17 * 60, endMinute: 11 * 60 })
    expect(clamped.endMinute).toBeGreaterThan(clamped.startMinute)
  })

  it('falls back to the default days when every day was deselected', () => {
    const clamped = clampCallingWindow({ ...WINDOW, activeDays: [] })
    expect(clamped.activeDays).toEqual(DEFAULT_CALLING_WINDOW.activeDays)
  })

  it('drops invalid weekday numbers instead of trusting them', () => {
    const clamped = clampCallingWindow({ ...WINDOW, activeDays: [1, 9, -2, 1, 3] })
    expect(clamped.activeDays).toEqual([1, 3])
  })

  it('is open inside the window and closed outside it', () => {
    expect(isWithinCallingWindow(riyadh(11), WINDOW)).toBe(true)
    expect(isWithinCallingWindow(riyadh(8), WINDOW)).toBe(false)
    expect(isWithinCallingWindow(riyadh(19), WINDOW)).toBe(false)
  })

  it('closes exactly at the end minute rather than one minute later', () => {
    expect(isWithinCallingWindow(riyadh(17, 59), WINDOW)).toBe(true)
    expect(isWithinCallingWindow(riyadh(18, 0), WINDOW)).toBe(false)
  })

  it('respects the local offset, not the server timezone', () => {
    // 07:00 UTC is 10:00 in Riyadh (open) and 08:00 in Cairo (shut).
    const at7Utc = new Date(Date.UTC(2026, 8, 7, 7, 0))
    expect(isWithinCallingWindow(at7Utc, { ...WINDOW, utcOffsetMinutes: 180 })).toBe(true)
    expect(isWithinCallingWindow(at7Utc, { ...WINDOW, utcOffsetMinutes: 120 })).toBe(false)
  })

  it('skips inactive days', () => {
    // 2026-09-11 is a Friday; the default week excludes Friday and Saturday.
    const friday = new Date(Date.UTC(2026, 8, 11, 8, 0))
    expect(isWithinCallingWindow(friday, WINDOW)).toBe(false)
  })

  it('reports the next opening as a real instant inside the window', () => {
    const next = nextWindowOpening(riyadh(22), WINDOW)
    expect(next.getTime()).toBeGreaterThan(riyadh(22).getTime())
    expect(isWithinCallingWindow(next, WINDOW)).toBe(true)
  })

  it('reports today when the window has not opened yet', () => {
    const next = nextWindowOpening(riyadh(7), WINDOW)
    expect(next.getTime() - riyadh(7).getTime()).toBeLessThan(4 * 3_600_000)
    expect(isWithinCallingWindow(next, WINDOW)).toBe(true)
  })
})

describe('pacing', () => {
  it('starts at one call, not at the ceiling', () => {
    expect(allowedConcurrency(null, riyadh(11))).toBe(1)
  })

  it('climbs with elapsed time and stops at the ceiling', () => {
    const start = riyadh(10)
    expect(allowedConcurrency(start, riyadh(10, 5))).toBe(1)
    expect(allowedConcurrency(start, riyadh(10, 10))).toBe(2)
    expect(allowedConcurrency(start, riyadh(10, 20))).toBe(3)
    expect(allowedConcurrency(start, riyadh(16))).toBe(DEFAULT_PACING.maxConcurrency)
  })

  it('never exceeds the platform ceiling however it is configured', () => {
    const wild = { initialConcurrency: 900, maxConcurrency: 900, rampMinutes: 1 }
    expect(allowedConcurrency(riyadh(10), riyadh(17), wild)).toBeLessThanOrEqual(5)
  })
})

describe('dispatch decision', () => {
  const base = {
    status: 'running' as const,
    now: riyadh(11),
    startedAt: riyadh(10),
    window: WINDOW,
    pacing: DEFAULT_PACING,
    inFlight: 0,
    remainingContacts: 50,
    callsPlacedToday: 0,
    dailyCap: 100,
    dialerReady: true,
  }

  it('allows calls when everything is in order', () => {
    const decision = dispatchDecision(base)
    expect(decision.reason).toBe('ok')
    expect(decision.allowed).toBeGreaterThan(0)
  })

  it('refuses when the dialer is not configured, before anything else', () => {
    // This is the state this deployment is actually in. It has to be a refusal
    // with a name, not a campaign that silently makes no progress.
    expect(dispatchDecision({ ...base, dialerReady: false })).toEqual({
      allowed: 0,
      reason: 'dialer_not_configured',
    })
  })

  it('refuses outside the calling window', () => {
    expect(dispatchDecision({ ...base, now: riyadh(22) }).reason).toBe('outside_window')
  })

  it('refuses a campaign that is not running', () => {
    expect(dispatchDecision({ ...base, status: 'paused' }).reason).toBe('not_running')
    expect(dispatchDecision({ ...base, status: 'approved' }).reason).toBe('not_running')
  })

  it('refuses once the daily cap is spent', () => {
    expect(dispatchDecision({ ...base, callsPlacedToday: 100 }).reason).toBe('daily_cap_reached')
  })

  it('never returns more than the daily cap has left', () => {
    const decision = dispatchDecision({ ...base, callsPlacedToday: 99, startedAt: riyadh(9) })
    expect(decision.allowed).toBe(1)
  })

  it('refuses when concurrency is already spent', () => {
    expect(dispatchDecision({ ...base, inFlight: 3, startedAt: riyadh(9) }).reason).toBe(
      'at_concurrency',
    )
  })

  it('never returns more than the contacts that remain', () => {
    const decision = dispatchDecision({ ...base, remainingContacts: 1, startedAt: riyadh(9) })
    expect(decision.allowed).toBe(1)
  })

  it('caps the daily cap at the platform maximum even if the row says more', () => {
    const decision = dispatchDecision({
      ...base,
      dailyCap: 10_000,
      callsPlacedToday: 500,
      startedAt: riyadh(9),
    })
    expect(decision.reason).toBe('daily_cap_reached')
  })
})

describe('contact import', () => {
  it('parses quoted fields, embedded commas and escaped quotes', () => {
    const rows = parseCsv('a,"b,c","d""e"')
    expect(rows).toEqual([['a', 'b,c', 'd"e']])
  })

  it('handles CRLF and a UTF-8 BOM from Excel', () => {
    const rows = parseCsv('﻿phone,name\r\n+966501234567,Sara\r\n')
    expect(rows).toEqual([
      ['phone', 'name'],
      ['+966501234567', 'Sara'],
    ])
  })

  it('accepts semicolon-separated exports from localised Excel', () => {
    const result = importContacts('phone;name\n+966501234567;سارة')
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]?.name).toBe('سارة')
  })

  it('reads Arabic column headers', () => {
    const result = importContacts('الجوال,الاسم\n0501234567,أحمد')
    expect(result.contacts[0]?.phone).toBe('+966501234567')
    expect(result.contacts[0]?.name).toBe('أحمد')
  })

  it('normalises local numbers to E.164', () => {
    const result = importContacts('phone\n0501234567\n00966501234568\n+966 50 123 4569')
    expect(result.contacts.map((c) => c.phone)).toEqual([
      '+966501234567',
      '+966501234568',
      '+966501234569',
    ])
  })

  it('keeps every rejected row with a reason and a line number', () => {
    // Rows dropped silently are numbers that are simply never called, and
    // nobody finds out. The reason and the line are what make that fixable.
    const result = importContacts('phone,name\nnot-a-number,X\n,Y\n+966501234567,Z')
    expect(result.contacts).toHaveLength(1)
    expect(result.issues).toEqual([
      { line: 2, raw: 'not-a-number,X', reason: 'invalid_phone' },
      { line: 3, raw: ',Y', reason: 'missing_phone' },
    ])
  })

  it('treats a repeat of the same number as a duplicate, however it was typed', () => {
    const result = importContacts('phone\n+966501234567\n0501234567')
    expect(result.contacts).toHaveLength(1)
    expect(result.issues[0]?.reason).toBe('duplicate_in_file')
  })

  it('works on a file with no header row at all', () => {
    const result = importContacts('+966501234567,Sara\n+966501234568,Omar')
    expect(result.contacts).toHaveLength(2)
    expect(result.headers).toEqual([])
  })

  it('stops at the limit and marks the overflow rather than truncating quietly', () => {
    const body = Array.from({ length: 5 }, (_, i) => `+96650123450${i}`).join('\n')
    const result = importContacts(`phone\n${body}`, 3)
    expect(result.contacts).toHaveLength(3)
    expect(result.issues).toHaveLength(2)
    expect(result.issues.every((i) => i.reason === 'over_limit')).toBe(true)
  })

  it('keeps the extra columns as fields for personalisation', () => {
    const result = importContacts('phone,name,city\n+966501234567,Sara,Riyadh')
    expect(result.contacts[0]?.fields).toEqual({ name: 'Sara', city: 'Riyadh' })
  })

  it('returns nothing for an empty file instead of throwing', () => {
    expect(importContacts('')).toEqual({ contacts: [], issues: [], headers: [], totalRows: 0 })
    expect(importContacts('\n\n  \n')).toEqual({
      contacts: [],
      issues: [],
      headers: [],
      totalRows: 0,
    })
  })
})

describe('readiness', () => {
  const ready = {
    name: 'متابعة عملاء أغسطس',
    purpose: 'followup' as const,
    consentBasis: 'existing_customer' as const,
    agentVersionId: 'av_1',
    fromNumberId: 'pn_1',
    contactCount: 40,
    script: 'اتصل بالعميل للاطمئنان على تجربته مع الخدمة، واسأله إن كان يحتاج مساعدة إضافية.',
    forbiddenClaims: 'لا تذكر أسعارًا ولا تعد بخصومات.',
    dialerReady: true,
  }

  it('passes a complete campaign', () => {
    expect(campaignReadiness(ready)).toEqual([])
    expect(isReadyToSubmit(campaignReadiness(ready))).toBe(true)
  })

  it('blocks a campaign with no legal basis for calling the list', () => {
    const problems = campaignReadiness({ ...ready, consentBasis: null })
    expect(problems.some((p) => p.field === 'consentBasis' && p.blocking)).toBe(true)
    expect(isReadyToSubmit(problems)).toBe(false)
  })

  it('blocks a campaign with no contacts, no agent, or no number', () => {
    for (const patch of [
      { contactCount: 0 },
      { agentVersionId: null },
      { fromNumberId: null },
    ] as const) {
      expect(isReadyToSubmit(campaignReadiness({ ...ready, ...patch }))).toBe(false)
    }
  })

  it('blocks when the dialer is not configured', () => {
    const problems = campaignReadiness({ ...ready, dialerReady: false })
    expect(problems.some((p) => p.field === 'dialer' && p.blocking)).toBe(true)
  })

  it('warns about missing forbidden claims without blocking on them', () => {
    const problems = campaignReadiness({ ...ready, forbiddenClaims: '' })
    expect(problems).toHaveLength(1)
    expect(problems[0]?.blocking).toBe(false)
    expect(isReadyToSubmit(problems)).toBe(true)
  })

  it('rejects a one-line script as instructions', () => {
    expect(isReadyToSubmit(campaignReadiness({ ...ready, script: 'اتصل بهم' }))).toBe(false)
  })
})

describe('attempt eligibility', () => {
  const now = riyadh(12)
  const base = {
    status: 'pending' as const,
    attempts: 0,
    lastAttemptAt: null,
    now,
    suppressed: false,
  }

  it('allows a fresh contact', () => {
    expect(canAttempt(base)).toEqual({ ok: true })
  })

  it('refuses a suppressed number before anything else', () => {
    // A number can be added to the do-not-call list after its row was queued.
    // Checking suppression first is what makes the list authoritative.
    expect(canAttempt({ ...base, status: 'queued', suppressed: true })).toEqual({
      ok: false,
      reason: 'suppressed',
    })
  })

  it('refuses a contact already on a call', () => {
    expect(canAttempt({ ...base, status: 'calling' })).toEqual({ ok: false, reason: 'in_flight' })
  })

  it('refuses a terminal contact', () => {
    expect(canAttempt({ ...base, status: 'completed' }).ok).toBe(false)
    expect(canAttempt({ ...base, status: 'cancelled' }).ok).toBe(false)
  })

  it('refuses once attempts are spent', () => {
    expect(canAttempt({ ...base, attempts: MAX_ATTEMPTS_PER_CONTACT })).toEqual({
      ok: false,
      reason: 'max_attempts',
    })
  })

  it('refuses a second call too soon after the first', () => {
    expect(canAttempt({ ...base, attempts: 1, lastAttemptAt: riyadh(11) })).toEqual({
      ok: false,
      reason: 'too_soon',
    })
  })

  it('allows a retry once the cool-off has passed', () => {
    expect(canAttempt({ ...base, attempts: 1, lastAttemptAt: riyadh(4) })).toEqual({ ok: true })
  })
})

describe('summaries and form helpers', () => {
  it('counts every status and reports what is finished', () => {
    const summary = summarizeContacts([
      'pending',
      'pending',
      'completed',
      'no_answer',
      'calling',
      'suppressed',
    ])
    expect(summary.total).toBe(6)
    expect(summary.pending).toBe(2)
    expect(summary.done).toBe(3)
  })

  it('round-trips a time field', () => {
    expect(minuteToTime(10 * 60 + 30)).toBe('10:30')
    expect(timeToMinute('10:30', 0)).toBe(630)
    expect(timeToMinute('nonsense', 600)).toBe(600)
    expect(timeToMinute('99:99', 600)).toBe(600)
  })
})
