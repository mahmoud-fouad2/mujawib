const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g

function latinDigits(value: string) {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
}

export function normalizeArabicSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .map((token) => (token.startsWith('ال') && token.length > 3 ? token.slice(2) : token))
    .join(' ')
}

export function arabicServiceMatches(title: string, requested: string): boolean {
  const known = normalizeArabicSearch(title)
  const query = normalizeArabicSearch(requested)
  if (!known || !query) return false
  if (known.includes(query) || query.includes(known)) return true
  const knownTokens = new Set(known.split(' '))
  const queryTokens = query.split(' ').filter((token) => token.length > 1)
  return queryTokens.length > 0 && queryTokens.every((token) => knownTokens.has(token))
}

/** Canonicalizes common Saudi local formats while preserving international numbers. */
export function normalizePhoneE164(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = latinDigits(value).trim()
  const hasPlus = normalized.startsWith('+')
  let digits = normalized.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!hasPlus && digits.length === 10 && digits.startsWith('05')) digits = `966${digits.slice(1)}`
  if (!hasPlus && digits.length === 9 && digits.startsWith('5')) digits = `966${digits}`
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null
  return `+${digits}`
}

/**
 * Builds a valid WhatsApp chat URL from any plausible phone format.
 * Handles local Saudi numbers (05xxxxxxxx -> 9665xxxxxxxx), removes punctuation,
 * and rejects masked numbers (+966****4567) that cannot be messaged.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  if (!phone || phone.includes('*')) return null
  const normalized = normalizePhoneE164(phone)
  if (!normalized) return null
  const digits = normalized.replace('+', '')
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${query}`
}
