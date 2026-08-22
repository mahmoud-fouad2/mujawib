/**
 * Display formatting. Arabic locale with Latin digits — the convention in Gulf
 * and Egyptian digital products, and the form the mono data face is cut for.
 */

const AR = 'ar-SA-u-nu-latn'

export function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(AR).format(value)
}

/**
 * Call durations read as m:ss, rolling up to h:mm:ss past the hour so a long
 * live call does not render as "1422:00".
 */
export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—'
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function clock(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(AR, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function dayMonth(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(AR, { day: 'numeric', month: 'long' }).format(d)
}

export function fullDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(AR, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/** "قبل 4 دقائق" — Arabic has dual and plural forms; Intl handles both. */
export function relative(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = d.getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat(AR, { numeric: 'auto' })

  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), 'second')
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < day * 30) return rtf.format(Math.round(diffMs / day), 'day')
  return dayMonth(d)
}

/** Masks the subscriber digits of a caller number — Bible §29 PII masking. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '—'
  if (e164.length < 7) return e164
  return `${e164.slice(0, 5)}…${e164.slice(-3)}`
}

/* ─── domain vocabulary ─────────────────────────────────────────────────── */

export const CALL_STATUS_LABEL: Record<string, string> = {
  accepting: 'قيد القبول',
  ringing: 'يرن',
  live: 'مباشرة',
  waiting_tool: 'بانتظار أداة',
  transferred: 'محوّلة',
  completed: 'مكتملة',
  completed_no_transcript: 'مكتملة بدون نص حوار',
  route_failed: 'فشل تحديد المسار',
  accept_failed: 'فشل قبول المكالمة',
  failed: 'فشلت',
  abandoned: 'مقطوعة',
}

/** True when the telephony path carried the call, whatever the record shows. */
export function callWasAnswered(status: string): boolean {
  return (
    status === 'live' ||
    status === 'waiting_tool' ||
    status === 'transferred' ||
    status === 'completed' ||
    status === 'completed_no_transcript'
  )
}

export const CALL_OUTCOME_LABEL: Record<string, string> = {
  resolved: 'تم الحل',
  booking: 'حجز',
  lead: 'عميل محتمل',
  transfer: 'تحويل',
  callback: 'معاودة اتصال',
  unresolved: 'لم تُحل',
  failed: 'فشل',
}

export const WORKSPACE_STATUS_LABEL: Record<string, string> = {
  discovery: 'اكتشاف',
  setup: 'إعداد',
  pilot: 'تجريبي',
  live: 'تشغيل',
  paused: 'موقوف',
}

export const HEALTH_LABEL: Record<string, string> = {
  connected: 'متصل',
  degraded: 'متذبذب',
  failed: 'فشل',
  disconnected: 'غير مربوط',
}

export const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  review: 'مراجعة',
  published: 'منشورة',
  archived: 'مؤرشفة',
}

export const CHANGE_STATUS_LABEL: Record<string, string> = {
  requested: 'مطلوب',
  in_review: 'قيد المراجعة',
  testing: 'اختبار',
  scheduled: 'مجدول',
  live: 'تم التنفيذ',
  rejected: 'مرفوض',
}

export const TOOL_LABEL: Record<string, string> = {
  check_availability: 'التحقق من التوفر',
  create_booking: 'إنشاء حجز',
  send_confirmation: 'إرسال التأكيد',
  find_customer: 'البحث عن العميل',
  create_lead: 'تسجيل عميل محتمل',
}

export const EVENT_LABEL: Record<string, string> = {
  ring: 'رنين',
  answered: 'تم الرد',
  agent_turn: 'المُجاوِب',
  caller_turn: 'المتصل',
  transfer: 'تحويل',
  ended: 'انتهت',
  abandoned: 'أُغلقت',
  sideband_connected: 'بدأت متابعة المكالمة',
  sideband_closed: 'اكتمل سجل المكالمة',
  tool_completed: 'اكتمل إجراء مرتبط',
  realtime_error: 'حدث يحتاج مراجعة',
  post_call_started: 'بدأ إعداد الملخص',
  post_call_completed: 'اكتمل ملخص المكالمة',
  post_call_failed: 'تعذر إعداد الملخص',
  post_call_skipped: 'لم يتوفر نص كافٍ للملخص',
}

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'signal'

export function outcomeTone(outcome: string | null): Tone {
  switch (outcome) {
    case 'booking':
    case 'resolved':
    case 'lead':
      return 'good'
    case 'transfer':
    case 'callback':
      return 'warn'
    case 'unresolved':
    case 'failed':
      return 'bad'
    default:
      return 'neutral'
  }
}

/**
 * `completed_no_transcript` is amber rather than red on purpose. The caller
 * reached the agent and the conversation happened; what is missing is our
 * transcript. Painting it red made a working telephony path look like an
 * outage, and left no colour free to mean "the caller heard nothing".
 */
export function statusTone(status: string): Tone {
  switch (status) {
    case 'live':
    case 'ringing':
    case 'accepting':
      return 'signal'
    case 'completed':
      return 'good'
    case 'waiting_tool':
    case 'transferred':
    case 'completed_no_transcript':
    case 'abandoned':
      return 'warn'
    case 'route_failed':
    case 'accept_failed':
    case 'failed':
      return 'bad'
    default:
      return 'neutral'
  }
}

export function healthTone(health: string): Tone {
  switch (health) {
    case 'connected':
      return 'good'
    case 'degraded':
      return 'warn'
    case 'failed':
      return 'bad'
    default:
      return 'neutral'
  }
}

export function workspaceTone(status: string): Tone {
  switch (status) {
    case 'live':
      return 'good'
    case 'pilot':
      return 'signal'
    case 'paused':
      return 'bad'
    default:
      return 'warn'
  }
}

/**
 * The phone lifecycle, in the operator's words.
 *
 * The console previously showed only "موثّق" or "بانتظار اختبار", which
 * collapsed the two states that need different actions: a number no call has
 * ever reached, and one calls reach but we cannot answer. Those are a carrier
 * problem and a platform problem respectively.
 */
export const PHONE_LIFECYCLE_LABEL: Record<string, string> = {
  pending: 'بانتظار أول مكالمة',
  verifying: 'وصلت مكالمة ولم يُرد عليها',
  verified: 'موثّق بمكالمة حقيقية',
  active: 'يعمل ويستقبل مكالمات',
  degraded: 'متعثر',
  disabled: 'معطّل',
}

/** What to do next about a number, given where it is in its lifecycle. */
export const PHONE_LIFECYCLE_HINT: Record<string, string> = {
  pending: 'لم تصل أي مكالمة بعد — راجع تحويل الرقم عند مزوّد الاتصال.',
  verifying: 'المكالمة تصل إلى المنصة لكن تعذّر الرد — راجع سجل القبول.',
  verified: 'المسار مثبت بمكالمة حقيقية واحدة على الأقل.',
  active: 'الرقم يستقبل المكالمات بشكل منتظم.',
  degraded: 'المسار كان يعمل ثم تعثر — راجع آخر خطأ.',
  disabled: 'المسار موقوف يدويًا ولا يستقبل مكالمات.',
}

export function phoneLifecycleTone(status: string | null): Tone {
  switch (status) {
    case 'active':
    case 'verified':
      return 'good'
    case 'verifying':
      return 'warn'
    case 'degraded':
      return 'bad'
    case 'disabled':
      return 'neutral'
    default:
      return 'warn'
  }
}
