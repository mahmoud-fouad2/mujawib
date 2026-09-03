import { normalizePhoneE164 } from '@/lib/voice-normalization'

/**
 * Outbound campaigns — the pure half.
 *
 * Everything here is decidable without a database, a clock we do not control,
 * or a provider: parsing an uploaded list, deciding whether a number may be
 * dialled right now, and deciding how many calls a campaign is allowed to
 * start in this instant. That boundary is deliberate. An outbound dialer is
 * the one feature in this product that can harm people who never asked to
 * hear from us, so the rules that stop it doing that have to be testable
 * without standing up any infrastructure at all.
 *
 * The limits below are not tuning knobs. They are the difference between a
 * campaign and a spam run, and they are enforced again in the dispatcher.
 */

/* ─── hard limits ────────────────────────────────────────────────────────── */

/** One upload. Past this the file is almost certainly a purchased list. */
export const MAX_CONTACTS_PER_CAMPAIGN = 5_000
/** Per contact, across the whole campaign. */
export const MAX_ATTEMPTS_PER_CONTACT = 3
/** Never two calls to the same person inside this window. */
export const MIN_MINUTES_BETWEEN_ATTEMPTS = 240
/** Ceiling on simultaneous outbound calls per campaign. */
export const MAX_CONCURRENT_CALLS = 5
/** Ceiling on outbound calls per workspace per day, across all campaigns. */
export const MAX_CALLS_PER_DAY = 500
/** Nothing dials before or after this, whatever the operator typed. */
export const EARLIEST_CALL_MINUTE = 9 * 60
export const LATEST_CALL_MINUTE = 21 * 60

/* ─── statuses ───────────────────────────────────────────────────────────── */

export const CAMPAIGN_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'running',
  'paused',
  'completed',
  'stopped',
  'rejected',
] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'مسودة',
  pending_review: 'بانتظار الموافقة',
  approved: 'معتمدة',
  running: 'قيد التشغيل',
  paused: 'موقوفة مؤقتًا',
  completed: 'اكتملت',
  stopped: 'أُوقفت',
  rejected: 'مرفوضة',
}

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, 'neutral' | 'signal' | 'good' | 'warn'> =
  {
    draft: 'neutral',
    pending_review: 'warn',
    approved: 'signal',
    running: 'good',
    paused: 'warn',
    // Not 'good': this fires once nothing is left to dial, whether every
    // attempt succeeded or every one was refused by the provider. A green
    // pill next to a 100%-refused campaign reads as success it did not earn —
    // the real outcome is the per-contact counts beside it, not this word.
    completed: 'neutral',
    stopped: 'neutral',
    rejected: 'neutral',
  }

export const CONTACT_STATUSES = [
  'pending',
  'queued',
  'calling',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'suppressed',
  'cancelled',
] as const
export type CampaignContactStatus = (typeof CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABEL: Record<CampaignContactStatus, string> = {
  pending: 'في الانتظار',
  queued: 'في الطابور',
  calling: 'جارٍ الاتصال',
  completed: 'تم',
  no_answer: 'لا رد',
  busy: 'مشغول',
  failed: 'فشل',
  suppressed: 'محظور',
  cancelled: 'أُلغي',
}

/** Statuses that will never be attempted again without an explicit retry. */
export const TERMINAL_CONTACT_STATUSES: readonly CampaignContactStatus[] = [
  'completed',
  'suppressed',
  'cancelled',
]

export const CAMPAIGN_PURPOSES = [
  'followup',
  'reminder',
  'survey',
  'announcement',
  'sales',
] as const
export type CampaignPurpose = (typeof CAMPAIGN_PURPOSES)[number]

export const CAMPAIGN_PURPOSE_LABEL: Record<CampaignPurpose, string> = {
  followup: 'متابعة عميل حالي',
  reminder: 'تذكير بموعد',
  survey: 'استطلاع رضا',
  announcement: 'إعلان أو تحديث',
  sales: 'عرض بيعي',
}

/**
 * Why we are allowed to call this list at all.
 *
 * There is no "we found the numbers online" option, and that is the point.
 * The operator has to name a basis before a single number is dialled, and the
 * basis is stored on the campaign so it can be produced later if anyone asks.
 */
export const CONSENT_BASES = ['existing_customer', 'explicit_optin', 'inbound_request'] as const
export type ConsentBasis = (typeof CONSENT_BASES)[number]

export const CONSENT_BASIS_LABEL: Record<ConsentBasis, string> = {
  existing_customer: 'عميل حالي — سبق تعامله مع النشاط',
  explicit_optin: 'موافقة صريحة مسجّلة على تلقي الاتصال',
  inbound_request: 'طلب صادر منه هو (اتصل أو ترك بياناته)',
}

/* ─── calling window ─────────────────────────────────────────────────────── */

export type CallingWindow = {
  /** Minutes from local midnight. */
  startMinute: number
  endMinute: number
  /** 0 = Sunday … 6 = Saturday, in workspace-local time. */
  activeDays: number[]
  /** Workspace offset from UTC in minutes (Riyadh = 180). */
  utcOffsetMinutes: number
}

export const DEFAULT_CALLING_WINDOW: CallingWindow = {
  startMinute: 10 * 60,
  endMinute: 18 * 60,
  activeDays: [0, 1, 2, 3, 4],
  utcOffsetMinutes: 180,
}

/**
 * Clamps whatever the operator typed into the hours a business may decently
 * call in. A window of 02:00–05:00 is not honoured, it is corrected — silently
 * rejecting it would leave a campaign that never dials with no explanation,
 * and honouring it would ring somebody's phone at 3am.
 */
export function clampCallingWindow(window: CallingWindow): CallingWindow {
  const start = Math.max(
    EARLIEST_CALL_MINUTE,
    Math.min(window.startMinute, LATEST_CALL_MINUTE - 60),
  )
  const end = Math.min(LATEST_CALL_MINUTE, Math.max(window.endMinute, start + 60))
  const days = [
    ...new Set(window.activeDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ]
  return {
    startMinute: start,
    endMinute: end,
    activeDays:
      days.length > 0 ? days.sort((a, b) => a - b) : [...DEFAULT_CALLING_WINDOW.activeDays],
    utcOffsetMinutes: Number.isFinite(window.utcOffsetMinutes)
      ? Math.max(-720, Math.min(840, Math.trunc(window.utcOffsetMinutes)))
      : DEFAULT_CALLING_WINDOW.utcOffsetMinutes,
  }
}

/** Local wall-clock parts for an instant, in the campaign's own offset. */
export function localParts(now: Date, utcOffsetMinutes: number) {
  const shifted = new Date(now.getTime() + utcOffsetMinutes * 60_000)
  return {
    day: shifted.getUTCDay(),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

export function isWithinCallingWindow(now: Date, window: CallingWindow): boolean {
  const safe = clampCallingWindow(window)
  const { day, minute } = localParts(now, safe.utcOffsetMinutes)
  if (!safe.activeDays.includes(day)) return false
  return minute >= safe.startMinute && minute < safe.endMinute
}

/** When the window next opens, for a UI that must say "resumes at …". */
export function nextWindowOpening(now: Date, window: CallingWindow): Date {
  const safe = clampCallingWindow(window)
  for (let ahead = 0; ahead <= 8; ahead += 1) {
    const probe = new Date(now.getTime() + ahead * 86_400_000)
    const { day, minute } = localParts(probe, safe.utcOffsetMinutes)
    if (!safe.activeDays.includes(day)) continue
    if (ahead === 0 && minute >= safe.startMinute) continue
    const shifted = new Date(probe.getTime() + safe.utcOffsetMinutes * 60_000)
    const midnightUtc = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    )
    return new Date(midnightUtc + safe.startMinute * 60_000 - safe.utcOffsetMinutes * 60_000)
  }
  return new Date(now.getTime() + 86_400_000)
}

/* ─── pacing ─────────────────────────────────────────────────────────────── */

export type PacingConfig = {
  /** Calls allowed in flight at the very start of a run. */
  initialConcurrency: number
  /** Ceiling once the campaign has proven itself. */
  maxConcurrency: number
  /** How often the ceiling rises by one. */
  rampMinutes: number
}

export const DEFAULT_PACING: PacingConfig = {
  initialConcurrency: 1,
  maxConcurrency: 3,
  rampMinutes: 10,
}

/**
 * Concurrency starts at one and climbs.
 *
 * The first calls of a campaign are the ones most likely to reveal a bad
 * script, a wrong list, or a misconfigured number. Starting at full speed
 * means discovering that after two hundred people have been called; starting
 * at one means discovering it after one.
 */
export function allowedConcurrency(
  startedAt: Date | null,
  now: Date,
  pacing: PacingConfig = DEFAULT_PACING,
): number {
  const max = Math.max(1, Math.min(pacing.maxConcurrency, MAX_CONCURRENT_CALLS))
  const initial = Math.max(1, Math.min(pacing.initialConcurrency, max))
  if (!startedAt) return initial
  const minutes = Math.max(0, (now.getTime() - startedAt.getTime()) / 60_000)
  const steps = pacing.rampMinutes > 0 ? Math.floor(minutes / pacing.rampMinutes) : 0
  return Math.min(max, initial + steps)
}

export type DispatchInput = {
  status: CampaignStatus
  now: Date
  startedAt: Date | null
  window: CallingWindow
  pacing: PacingConfig
  inFlight: number
  remainingContacts: number
  callsPlacedToday: number
  dailyCap: number
  dialerReady: boolean
}

export type DispatchReason =
  | 'ok'
  | 'not_running'
  | 'outside_window'
  | 'at_concurrency'
  | 'daily_cap_reached'
  | 'no_contacts'
  | 'dialer_not_configured'

export type DispatchDecision = {
  allowed: number
  /** Machine-readable, because the UI has to explain a zero. */
  reason: DispatchReason
}

/**
 * How many calls this campaign may start right now, and — when the answer is
 * none — which rule said so. A campaign that quietly does nothing is
 * indistinguishable from a broken one, so the reason is part of the result.
 */
export function dispatchDecision(input: DispatchInput): DispatchDecision {
  if (input.status !== 'running') return { allowed: 0, reason: 'not_running' }
  if (!input.dialerReady) return { allowed: 0, reason: 'dialer_not_configured' }
  if (input.remainingContacts <= 0) return { allowed: 0, reason: 'no_contacts' }
  if (!isWithinCallingWindow(input.now, input.window)) {
    return { allowed: 0, reason: 'outside_window' }
  }
  const cap = Math.max(0, Math.min(input.dailyCap, MAX_CALLS_PER_DAY))
  const dailyRemaining = cap - input.callsPlacedToday
  if (dailyRemaining <= 0) return { allowed: 0, reason: 'daily_cap_reached' }

  const concurrency = allowedConcurrency(input.startedAt, input.now, input.pacing)
  const slots = concurrency - input.inFlight
  if (slots <= 0) return { allowed: 0, reason: 'at_concurrency' }

  return {
    allowed: Math.max(0, Math.min(slots, dailyRemaining, input.remainingContacts)),
    reason: 'ok',
  }
}

export const DISPATCH_REASON_LABEL: Record<DispatchReason, string> = {
  ok: 'يعمل',
  not_running: 'الحملة ليست قيد التشغيل',
  outside_window: 'خارج نافذة الاتصال المسموحة',
  at_concurrency: 'بلغت الحد الأقصى للمكالمات المتزامنة',
  daily_cap_reached: 'بلغت الحد اليومي',
  no_contacts: 'لا توجد جهات متبقية',
  dialer_not_configured: 'الاتصال الصادر غير مُهيّأ',
}

/* ─── CSV import ─────────────────────────────────────────────────────────── */

export type ParsedContact = {
  /** 1-based line in the uploaded file, so an error can be pointed at. */
  line: number
  phone: string
  name: string | null
  note: string | null
  fields: Record<string, string>
}

export type ContactImportReason =
  | 'invalid_phone'
  | 'missing_phone'
  | 'duplicate_in_file'
  | 'over_limit'

export type ContactImportIssue = {
  line: number
  raw: string
  reason: ContactImportReason
}

export type ContactImport = {
  contacts: ParsedContact[]
  issues: ContactImportIssue[]
  headers: string[]
  totalRows: number
}

export const CONTACT_IMPORT_ISSUE_LABEL: Record<ContactImportReason, string> = {
  invalid_phone: 'رقم غير صالح',
  missing_phone: 'لا يوجد رقم',
  duplicate_in_file: 'مكرر داخل الملف',
  over_limit: 'تجاوز الحد الأقصى للجهات',
}

const PHONE_HEADERS = ['phone', 'mobile', 'number', 'tel', 'msisdn', 'الهاتف', 'الجوال', 'رقم']
const NAME_HEADERS = ['name', 'fullname', 'full_name', 'contact', 'الاسم', 'اسم']
const NOTE_HEADERS = ['note', 'notes', 'comment', 'ملاحظة', 'ملاحظات']

/**
 * RFC4180-shaped CSV, written by hand.
 *
 * A dependency is not worth it for one input, and the failure mode we care
 * about is not exotic quoting — it is an Arabic column header, a UTF-8 BOM
 * from Excel, and a semicolon-separated export from a localised Excel.
 * Splitting on commas would break all three.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]
    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',' || char === ';' || char === '\t') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  for (const candidate of candidates) {
    const found = normalized.findIndex((h) => h === candidate || h.includes(candidate))
    if (found >= 0) return found
  }
  return -1
}

/**
 * Turns an uploaded file into contacts and a list of what was thrown away.
 *
 * Rejected rows are returned, not dropped. Somebody uploading four hundred
 * numbers and getting three hundred and ninety back needs to know which ten
 * were wrong and why — otherwise the missing ten are simply never called and
 * nobody finds out.
 */
export function importContacts(text: string, limit = MAX_CONTACTS_PER_CAMPAIGN): ContactImport {
  const rows = parseCsv(text)
  if (rows.length === 0) return { contacts: [], issues: [], headers: [], totalRows: 0 }

  const first = rows[0] ?? []
  // A header row is one in which no cell at all parses as a phone number.
  const looksLikeHeader = first.every((cell) => normalizePhoneE164(cell) === null)
  const headers = looksLikeHeader ? first.map((h) => h.trim()) : []
  const body = looksLikeHeader ? rows.slice(1) : rows

  const phoneAt = looksLikeHeader ? headerIndex(headers, PHONE_HEADERS) : -1
  const nameAt = looksLikeHeader ? headerIndex(headers, NAME_HEADERS) : -1
  const noteAt = looksLikeHeader ? headerIndex(headers, NOTE_HEADERS) : -1

  const contacts: ParsedContact[] = []
  const issues: ContactImportIssue[] = []
  const seen = new Set<string>()

  body.forEach((cells, index) => {
    const line = index + (looksLikeHeader ? 2 : 1)
    const raw = cells.join(',').slice(0, 200)

    // With no recognisable phone column, try every cell before giving up —
    // a file exported with no headers is common and entirely usable.
    const candidate =
      phoneAt >= 0 ? (cells[phoneAt] ?? '') : (cells.find((c) => normalizePhoneE164(c)) ?? '')
    if (!candidate.trim()) {
      issues.push({ line, raw, reason: 'missing_phone' })
      return
    }
    const phone = normalizePhoneE164(candidate)
    if (!phone) {
      issues.push({ line, raw, reason: 'invalid_phone' })
      return
    }
    if (seen.has(phone)) {
      issues.push({ line, raw, reason: 'duplicate_in_file' })
      return
    }
    if (contacts.length >= limit) {
      issues.push({ line, raw, reason: 'over_limit' })
      return
    }
    seen.add(phone)

    const fields: Record<string, string> = {}
    if (headers.length > 0) {
      headers.forEach((header, at) => {
        const value = (cells[at] ?? '').trim()
        if (value && at !== phoneAt) fields[header] = value.slice(0, 200)
      })
    }

    const name = nameAt >= 0 ? (cells[nameAt] ?? '').trim() : ''
    const note = noteAt >= 0 ? (cells[noteAt] ?? '').trim() : ''
    contacts.push({
      line,
      phone,
      name: name ? name.slice(0, 120) : null,
      note: note ? note.slice(0, 400) : null,
      fields,
    })
  })

  return { contacts, issues, headers, totalRows: body.length }
}

/* ─── readiness ──────────────────────────────────────────────────────────── */

export type ReadinessInput = {
  name: string
  purpose: CampaignPurpose | null
  consentBasis: ConsentBasis | null
  agentVersionId: string | null
  fromNumberId: string | null
  contactCount: number
  script: string | null
  forbiddenClaims: string | null
  dialerReady: boolean
}

export type ReadinessProblem = { field: string; message: string; blocking: boolean }

/**
 * Everything standing between a draft and a call being placed.
 *
 * Returned as a list rather than a boolean because the review screen has to
 * show all of them at once — sending an operator back six times to fix one
 * field each is how a compliance gate becomes something people work around.
 */
export function campaignReadiness(input: ReadinessInput): ReadinessProblem[] {
  const problems: ReadinessProblem[] = []
  const need = (field: string, message: string, ok: boolean) => {
    if (!ok) problems.push({ field, message, blocking: true })
  }

  need('name', 'اسم الحملة مطلوب.', input.name.trim().length >= 3)
  need('purpose', 'حدّد الغرض من الحملة.', input.purpose !== null)
  need('consentBasis', 'حدّد الأساس القانوني للاتصال بهذه القائمة.', input.consentBasis !== null)
  need('agentVersionId', 'اختر الموظف الصوتي الذي سيجري المكالمات.', !!input.agentVersionId)
  need('fromNumberId', 'اختر الرقم الذي ستظهر منه المكالمة.', !!input.fromNumberId)
  need('contacts', 'ارفع قائمة جهات الاتصال أولًا.', input.contactCount > 0)
  need(
    'script',
    'اكتب تعليمات المكالمة (٤٠ حرفًا على الأقل).',
    (input.script ?? '').trim().length >= 40,
  )

  if (!input.dialerReady) {
    problems.push({
      field: 'dialer',
      message: 'الاتصال الصادر غير مُهيّأ على هذا الخادم — يمكن حفظ الحملة ومراجعتها، ولن تبدأ.',
      blocking: true,
    })
  }
  if (!(input.forbiddenClaims ?? '').trim()) {
    problems.push({
      field: 'forbiddenClaims',
      message: 'لم تُحدَّد ادعاءات ممنوعة. يُنصح بذكر ما يجب ألا يقوله الموظف (أسعار، وعود، ضمانات).',
      blocking: false,
    })
  }
  return problems
}

export function isReadyToSubmit(problems: ReadinessProblem[]): boolean {
  return !problems.some((p) => p.blocking)
}

/* ─── attempt eligibility ────────────────────────────────────────────────── */

export type AttemptInput = {
  status: CampaignContactStatus
  attempts: number
  lastAttemptAt: Date | null
  now: Date
  suppressed: boolean
}

export type AttemptRefusal = 'terminal' | 'suppressed' | 'max_attempts' | 'too_soon' | 'in_flight'

export type AttemptDecision = { ok: true } | { ok: false; reason: AttemptRefusal }

export const ATTEMPT_REASON_LABEL: Record<AttemptRefusal, string> = {
  terminal: 'انتهت هذه الجهة',
  suppressed: 'الرقم في قائمة الحظر',
  max_attempts: 'استُنفدت المحاولات',
  too_soon: 'لم تمر المدة اللازمة منذ آخر محاولة',
  in_flight: 'مكالمة جارية بالفعل',
}

/**
 * The last gate before a number is dialled, applied per contact.
 *
 * `suppressed` is checked first and separately from status: a number can land
 * on the do-not-call list after its row was already queued, and the queue must
 * not be the thing that decides. Called again inside the dispatcher for every
 * single call rather than once at queue time, for exactly that reason.
 */
export function canAttempt(input: AttemptInput): AttemptDecision {
  if (input.suppressed) return { ok: false, reason: 'suppressed' }
  if (input.status === 'calling') return { ok: false, reason: 'in_flight' }
  if (TERMINAL_CONTACT_STATUSES.includes(input.status)) return { ok: false, reason: 'terminal' }
  if (input.attempts >= MAX_ATTEMPTS_PER_CONTACT) return { ok: false, reason: 'max_attempts' }
  if (input.lastAttemptAt) {
    const elapsed = (input.now.getTime() - input.lastAttemptAt.getTime()) / 60_000
    if (elapsed < MIN_MINUTES_BETWEEN_ATTEMPTS) return { ok: false, reason: 'too_soon' }
  }
  return { ok: true }
}

/** Progress for a list screen: one pass, no per-status filters. */
export function summarizeContacts(statuses: readonly CampaignContactStatus[]) {
  const counts = Object.fromEntries(CONTACT_STATUSES.map((s) => [s, 0])) as Record<
    CampaignContactStatus,
    number
  >
  for (const status of statuses) counts[status] += 1
  const done = CONTACT_STATUSES.filter((s) => s !== 'pending' && s !== 'queued' && s !== 'calling')
    .map((s) => counts[s])
    .reduce((a, b) => a + b, 0)
  return { ...counts, total: statuses.length, done }
}

/** Minutes-from-midnight to `HH:MM`, for an `<input type="time">`. */
export function minuteToTime(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeToMinute(value: string, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return fallback
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return fallback
  return h * 60 + m
}

export const WEEKDAY_LABEL = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
]
