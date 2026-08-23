import { CALL_OUTCOME_LABEL } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/**
 * English for the operational vocabulary the marketing pages read out of the
 * database.
 *
 * The console is Arabic-only, so `lib/format` holds one Arabic label per value
 * and that is correct there. The public site is not: `/en` was rendering
 * "تم الحل" and "حجز موعد" inside otherwise English cards, which reads as a
 * half-translated page rather than an Arabic product.
 *
 * Anything unmapped falls through to the stored value. That is the right
 * failure: a client's own wording is better shown as written than dropped, and
 * it makes a missing entry visible instead of silent.
 */

const OUTCOME_EN: Record<string, string> = {
  resolved: 'Resolved',
  booking: 'Booked',
  lead: 'Lead captured',
  transfer: 'Transferred',
  callback: 'Callback logged',
  unresolved: 'Unresolved',
  failed: 'Failed',
}

/** The intents the demo scenarios are built from. */
const INTENT_EN: Record<string, string> = {
  'حجز موعد': 'Book an appointment',
  'تغيير موعد': 'Move an appointment',
  'إلغاء موعد': 'Cancel an appointment',
  'استفسار عن سعر': 'Price enquiry',
  'استفسار عن طبيب': 'Which doctor',
  'استفسار عن طلب': 'Order status',
  'استفسار عن مشروع': 'Project enquiry',
  'تحويل لقسم': 'Route to a department',
  'تحويل لمستشار مبيعات': 'Route to a sales consultant',
  'ترك رسالة': 'Leave a message',
  'حجز صيانة': 'Book a service slot',
  'حجز معاينة': 'Book a viewing',
  شكوى: 'Complaint',
  'طلب عرض سعر': 'Request a quote',
  'متابعة حالة السيارة': 'Check on a car',
}

/** The default flows shipped with each industry pack. */
const FLOW_EN: Record<string, string> = {
  'حجز موعد': 'Booking',
  'تغيير موعد': 'Rescheduling',
  إلغاء: 'Cancellation',
  استفسارات: 'Enquiries',
  تحويل: 'Transfer',
  'تأهيل عميل': 'Lead qualification',
  'حجز معاينة': 'Viewing booking',
  'تحويل مبيعات': 'Sales handover',
  'حجز صيانة': 'Service booking',
  'حالة الطلب': 'Order status',
  استفسار: 'Enquiries',
  توجيه: 'Routing',
  رسالة: 'Messages',
  'معاودة اتصال': 'Callbacks',
  'عميل محتمل': 'Lead capture',
}

export function outcomeLabel(outcome: string | null, locale: Locale): string | null {
  if (!outcome) return null
  return (locale === 'en' ? OUTCOME_EN[outcome] : CALL_OUTCOME_LABEL[outcome]) ?? outcome
}

export function intentLabel(intent: string | null, locale: Locale): string | null {
  if (!intent) return null
  return locale === 'en' ? (INTENT_EN[intent] ?? intent) : intent
}

export function flowLabel(flow: string, locale: Locale): string {
  return locale === 'en' ? (FLOW_EN[flow] ?? flow) : flow
}
