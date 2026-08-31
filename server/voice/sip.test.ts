import { describe, expect, it } from 'vitest'
import { callerFrom, didCandidates, providerObserved, toE164 } from './sip'

/**
 * The ingress provider's choice of header for the originally dialled DID is
 * discovered, not assumed — see the header comment on didCandidates for why.
 * These cases are the shapes that decision was built against: To, Diversion,
 * P-Called-Party-ID without a leading +, and no DID present at all.
 */

const DID = '+18574444576'

describe('toE164', () => {
  it('normalises a spaced international number', () => {
    expect(toE164('+1 857 444 4576')).toBe(DID)
  })

  it('normalises a punctuated number', () => {
    expect(toE164('+1 (857) 444-4576')).toBe(DID)
  })

  it('keeps a number without a leading + bare, rather than inventing a country code', () => {
    expect(toE164('18574444576')).toBe('18574444576')
  })

  it('rejects a token too short to be a phone number', () => {
    expect(toE164('4576')).toBeNull()
  })

  it('rejects a non-numeric token', () => {
    expect(toE164('reception')).toBeNull()
  })
})

describe('didCandidates', () => {
  it('finds the DID in To', () => {
    const candidates = didCandidates([
      { name: 'To', value: `<sip:${DID}@sip.api.openai.com>` },
      { name: 'From', value: '"Caller" <sip:+201234567890@provider.example>' },
    ])
    expect(candidates.filter((c) => c.e164 === DID).map((c) => c.header)).toEqual(['To'])
  })

  it('finds the DID in Diversion when To carries the project id instead', () => {
    const candidates = didCandidates([
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'Diversion', value: `<sip:${DID}@provider.example>;reason=unconditional` },
    ])
    expect(candidates.filter((c) => c.e164 === DID).map((c) => c.header)).toEqual(['Diversion'])
  })

  it('finds the DID in P-Called-Party-ID even without a leading +', () => {
    const candidates = didCandidates([
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'P-Called-Party-ID', value: '<sip:18574444576@provider.example;user=phone>' },
    ])
    expect(candidates.filter((c) => c.e164 === DID).map((c) => c.header)).toEqual([
      'P-Called-Party-ID',
    ])
  })

  it('resolves nothing when no header carries the DID', () => {
    const candidates = didCandidates([
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'From', value: '<sip:+201234567890@provider.example>' },
    ])
    expect(candidates.filter((c) => c.e164 === DID)).toEqual([])
  })
})

describe('callerFrom', () => {
  it('extracts the caller number from From', () => {
    expect(callerFrom([{ name: 'From', value: '"X" <sip:+201234567890@provider.example>' }])).toBe(
      '+201234567890',
    )
  })

  it('returns null rather than blocking the call when From is missing', () => {
    expect(callerFrom([{ name: 'To', value: '<sip:x@y>' }])).toBeNull()
  })

  it('prefers the full asserted identity when From is anonymised', () => {
    expect(
      callerFrom([
        { name: 'From', value: '"Anonymous" <sip:anonymous@invalid>' },
        { name: 'P-Asserted-Identity', value: '<sip:966530047640@provider.example>' },
      ]),
    ).toBe('+966530047640')
  })

  it('does not mistake a destination header for caller identity', () => {
    expect(callerFrom([{ name: 'To', value: '<sip:+16513711782@provider.example>' }])).toBeNull()
  })
})

describe('providerObserved', () => {
  it('reads the User-Agent header case-insensitively', () => {
    expect(providerObserved([{ name: 'user-agent', value: 'Sonetel-SBC/2.4' }])).toBe(
      'Sonetel-SBC/2.4',
    )
  })

  it('strips control characters and caps length so a hostile header cannot pollute logs', () => {
    const long = `x\r\n\t${'A'.repeat(200)}`
    const result = providerObserved([{ name: 'User-Agent', value: long }])
    expect(result).not.toBeNull()
    expect(result?.length).toBeLessThanOrEqual(80)
    expect(result).not.toMatch(/[\r\n\t]/)
  })

  it('returns null when there is no User-Agent header', () => {
    expect(providerObserved([{ name: 'To', value: '<sip:x@y>' }])).toBeNull()
  })
})
