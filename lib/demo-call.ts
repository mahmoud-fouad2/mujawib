import { normalizePhoneE164 } from '@/lib/voice-normalization'

/**
 * The public "call me" request — the rules, without the database.
 *
 * This is the only path in the product where somebody with no account can
 * cause a phone to ring, so the rules that decide whether it may are worth
 * being able to test on their own.
 *
 * The countries below are not a marketing decision. A public form that will
 * dial anywhere is a free international-calling service for whoever finds it;
 * restricting it to the markets the product actually serves is what makes the
 * cost of abuse bounded rather than unbounded.
 */

export type DemoCountry = {
  code: string
  /** E.164 country calling code, without the plus. */
  dial: string
  labelAr: string
  labelEn: string
}

export const DEMO_COUNTRIES: DemoCountry[] = [
  { code: 'SA', dial: '966', labelAr: 'السعودية', labelEn: 'Saudi Arabia' },
  { code: 'AE', dial: '971', labelAr: 'الإمارات', labelEn: 'United Arab Emirates' },
  { code: 'KW', dial: '965', labelAr: 'الكويت', labelEn: 'Kuwait' },
  { code: 'QA', dial: '974', labelAr: 'قطر', labelEn: 'Qatar' },
  { code: 'BH', dial: '973', labelAr: 'البحرين', labelEn: 'Bahrain' },
  { code: 'OM', dial: '968', labelAr: 'عُمان', labelEn: 'Oman' },
  { code: 'EG', dial: '20', labelAr: 'مصر', labelEn: 'Egypt' },
  { code: 'JO', dial: '962', labelAr: 'الأردن', labelEn: 'Jordan' },
]

export function demoCountry(code: string): DemoCountry | null {
  return DEMO_COUNTRIES.find((c) => c.code === code.trim().toUpperCase()) ?? null
}

export type DemoPhoneRefusal =
  | 'unknown_country'
  | 'invalid_number'
  | 'country_mismatch'
  | 'too_short'

export type DemoPhoneResult =
  | { ok: true; phone: string; country: DemoCountry }
  | { ok: false; reason: DemoPhoneRefusal }

export const DEMO_PHONE_REFUSAL_LABEL: Record<DemoPhoneRefusal, string> = {
  unknown_country: 'اختر دولة من القائمة.',
  invalid_number: 'الرقم غير صالح. اكتبه بأرقام فقط.',
  country_mismatch: 'الرقم لا يطابق الدولة المختارة.',
  too_short: 'الرقم قصير جدًا.',
}

/**
 * Turns a country choice and a typed number into one E.164 number, or a
 * reason it will not be called.
 *
 * The country is checked against the number rather than merely prefixed onto
 * it. Somebody selecting Saudi Arabia and pasting a full foreign number in
 * international form would otherwise get that foreign number dialled while
 * the form showed them a Saudi flag.
 */
export function normalizeDemoPhone(countryCode: string, raw: string): DemoPhoneResult {
  const country = demoCountry(countryCode)
  if (!country) return { ok: false, reason: 'unknown_country' }

  const typed = raw.trim()
  if (!typed) return { ok: false, reason: 'invalid_number' }

  // A number already in international form is taken as written, so the
  // country check below can catch a mismatch instead of hiding it.
  const looksInternational = typed.startsWith('+') || typed.replace(/\D/g, '').startsWith('00')
  const national = typed.replace(/\D/g, '').replace(/^0+/, '')
  const candidate = looksInternational ? typed : `+${country.dial}${national}`

  const phone = normalizePhoneE164(candidate)
  if (!phone) return { ok: false, reason: 'invalid_number' }
  if (!phone.startsWith(`+${country.dial}`)) return { ok: false, reason: 'country_mismatch' }

  // Past the dial code there has to be an actual subscriber number.
  const subscriber = phone.slice(country.dial.length + 1)
  if (subscriber.length < 7) return { ok: false, reason: 'too_short' }

  return { ok: true, phone, country }
}

/* ─── abuse limits ───────────────────────────────────────────────────────── */

/** Requests one browser may submit in the window below. */
export const DEMO_REQUESTS_PER_ADDRESS = 3
export const DEMO_ADDRESS_WINDOW_MS = 60 * 60_000
/** One number may be requested once a day, however many people ask. */
export const DEMO_NUMBER_COOLDOWN_MS = 24 * 60 * 60_000

export type DemoThrottleInput = {
  now: Date
  /** Requests from this address inside the address window. */
  recentFromAddress: number
  /** The most recent request for this exact number, if any. */
  lastForNumberAt: Date | null
}

export type DemoThrottleRefusal = 'address_limit' | 'number_cooldown'

export type DemoThrottleResult = { ok: true } | { ok: false; reason: DemoThrottleRefusal }

export const DEMO_THROTTLE_LABEL: Record<DemoThrottleRefusal, string> = {
  address_limit: 'وصلت للحد المسموح من الطلبات. جرّب بعد ساعة.',
  number_cooldown: 'سبق طلب مكالمة تجريبية لهذا الرقم اليوم.',
}

/**
 * Two limits, and the second is the one that matters.
 *
 * Limiting per browser only stops one person clicking repeatedly. Limiting
 * per number is what stops someone using this form to make a stranger's phone
 * ring, which is the failure mode a public dialer actually has.
 */
export function demoThrottle(input: DemoThrottleInput): DemoThrottleResult {
  if (input.lastForNumberAt) {
    const since = input.now.getTime() - input.lastForNumberAt.getTime()
    if (since < DEMO_NUMBER_COOLDOWN_MS) return { ok: false, reason: 'number_cooldown' }
  }
  if (input.recentFromAddress >= DEMO_REQUESTS_PER_ADDRESS) {
    return { ok: false, reason: 'address_limit' }
  }
  return { ok: true }
}

export const DEMO_REQUEST_STATUSES = [
  'new',
  'approved',
  'calling',
  'completed',
  'failed',
  'rejected',
  'blocked',
] as const
export type DemoRequestStatusValue = (typeof DEMO_REQUEST_STATUSES)[number]

export const DEMO_REQUEST_STATUS_LABEL: Record<DemoRequestStatusValue, string> = {
  new: 'جديد',
  approved: 'معتمد للاتصال',
  calling: 'جارٍ الاتصال',
  completed: 'تمت المكالمة',
  failed: 'فشل الاتصال',
  rejected: 'مرفوض',
  blocked: 'محظور',
}

export const DEMO_REQUEST_STATUS_TONE: Record<
  DemoRequestStatusValue,
  'neutral' | 'signal' | 'good' | 'warn'
> = {
  new: 'signal',
  approved: 'warn',
  calling: 'warn',
  completed: 'good',
  failed: 'neutral',
  rejected: 'neutral',
  blocked: 'neutral',
}
