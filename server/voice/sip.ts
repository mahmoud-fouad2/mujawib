/**
 * Pulling the dialled DID out of the SIP headers OpenAI forwards.
 *
 * Different ingress providers preserve the originally called number in
 * different headers — `To` on some, `Diversion` or `P-Called-Party-ID` on
 * others once forwarding is involved. Rather than guess which one this
 * provider uses, every header is treated as a candidate and each extracted
 * number is checked against the explicitly configured routes. The header that
 * actually matched is then reported, so the resolver can be narrowed later on
 * evidence instead of assumption.
 */

export type SipHeader = { name: string; value: string }

export type DidCandidate = {
  /** Header the number came from, e.g. "To" or "Diversion". */
  header: string
  /** Normalised to E.164 where possible. */
  e164: string
  /** The untouched header value, for the diagnostic log. */
  raw: string
}

/** Source-party headers must never be mistaken for the number being called. */
const CALLER_IDENTITY_HEADERS = new Set([
  'contact',
  'from',
  'p-asserted-identity',
  'p-preferred-identity',
  'remote-party-id',
])

/**
 * Extracts every phone-number-shaped token from a header value.
 *
 * Handles the shapes SIP actually uses:
 *   <sip:+16513711782@host;user=phone>
 *   "Reception" <sip:16513711782@host>
 *   tel:+16513711782
 *   +16513711782
 */
function numbersIn(value: string): string[] {
  const found: string[] = []

  // sip:/sips:/tel: URIs — take the user part before @ or ;
  for (const match of value.matchAll(/(?:sips?|tel):([+\d][\d\-.()\s]*)/gi)) {
    if (match[1]) found.push(match[1])
  }

  // A bare number anywhere in the value, as a fallback for odd formats.
  for (const match of value.matchAll(/\+\d[\d\-.()\s]{6,}/g)) {
    if (match[0]) found.push(match[0])
  }

  return found
}

/**
 * Normalises to E.164. Returns null when the token cannot be one, so junk does
 * not end up being looked up as a route.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim()
  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length < 7 || digits.length > 15) return null
  // Without a leading +, the digits are only usable if they already look like
  // a full international number; we do not invent a country code.
  return hadPlus ? `+${digits}` : digits
}

/**
 * Every distinct DID candidate across all headers, in header order.
 *
 * Deliberately does not rank or filter by header name — the caller checks each
 * against the configured routes and the first configured match wins.
 */
export function didCandidates(headers: SipHeader[] | undefined): DidCandidate[] {
  if (!headers?.length) return []

  const seen = new Set<string>()
  const candidates: DidCandidate[] = []

  for (const header of headers) {
    if (CALLER_IDENTITY_HEADERS.has(header.name.trim().toLowerCase())) continue

    for (const token of numbersIn(header.value)) {
      const e164 = toE164(token)
      if (!e164) continue

      const key = `${header.name}:${e164}`
      if (seen.has(key)) continue
      seen.add(key)

      candidates.push({ header: header.name, e164, raw: header.value.slice(0, 200) })

      // Some providers send the number with and without a leading +; offer the
      // plus-prefixed form too so an E.164 route still matches.
      if (!e164.startsWith('+')) {
        const plus = `+${e164}`
        const plusKey = `${header.name}:${plus}`
        if (!seen.has(plusKey)) {
          seen.add(plusKey)
          candidates.push({ header: header.name, e164: plus, raw: header.value.slice(0, 200) })
        }
      }
    }
  }

  return candidates
}

/** The calling party, for the call record. Best effort — never blocks a call. */
export function callerFrom(headers: SipHeader[] | undefined): string | null {
  const from = headers?.find((h) => h.name.toLowerCase() === 'from')
  if (!from) return null
  const [first] = numbersIn(from.value)
  return first ? toE164(first) : null
}
