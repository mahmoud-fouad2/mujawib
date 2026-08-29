import { describe, expect, it } from 'vitest'
import {
  arabicServiceMatches,
  normalizeArabicSearch,
  normalizePhoneE164,
} from './voice-normalization'

describe('voice normalization', () => {
  it('matches common Arabic service variants without fuzzy guessing', () => {
    expect(arabicServiceMatches('الكشف العام', 'كشف عام')).toBe(true)
    expect(arabicServiceMatches('إستشارة الأسنان', 'استشاره الاسنان')).toBe(true)
    expect(arabicServiceMatches('صيانة السيارة', 'حجز عقار')).toBe(false)
    expect(normalizeArabicSearch('  الآشِعَّة  ')).toBe('اشعه')
  })

  it('canonicalizes Saudi local and Arabic-digit phone numbers', () => {
    expect(normalizePhoneE164('050 123 4567')).toBe('+966501234567')
    expect(normalizePhoneE164('٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567')
    expect(normalizePhoneE164('00966-50-123-4567')).toBe('+966501234567')
    expect(normalizePhoneE164('+1 651 371 1782')).toBe('+16513711782')
    expect(normalizePhoneE164('123')).toBeNull()
  })
})
