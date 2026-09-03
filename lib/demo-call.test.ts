import { describe, expect, it } from 'vitest'
import {
  DEMO_CODE_MAX_ATTEMPTS,
  DEMO_COUNTRIES,
  DEMO_NUMBER_COOLDOWN_MS,
  DEMO_REQUESTS_PER_ADDRESS,
  demoCountry,
  demoThrottle,
  looksFake,
  normalizeDemoPhone,
  verifyGate,
  withinGlobalDemoCap,
} from '@/lib/demo-call'

const NOW = new Date('2026-09-07T10:00:00Z')

describe('demo countries', () => {
  it('offers only markets the product serves', () => {
    // An unrestricted public dialer is a free international-calling service
    // for whoever finds the form.
    expect(DEMO_COUNTRIES.length).toBeGreaterThan(0)
    expect(DEMO_COUNTRIES.length).toBeLessThan(15)
  })

  it('gives every country a dial code and both labels', () => {
    for (const country of DEMO_COUNTRIES) {
      expect(country.dial).toMatch(/^\d{1,4}$/)
      expect(country.labelAr.length).toBeGreaterThan(2)
      expect(country.labelEn.length).toBeGreaterThan(2)
    }
  })

  it('has no duplicate codes or dial prefixes', () => {
    expect(new Set(DEMO_COUNTRIES.map((c) => c.code)).size).toBe(DEMO_COUNTRIES.length)
    expect(new Set(DEMO_COUNTRIES.map((c) => c.dial)).size).toBe(DEMO_COUNTRIES.length)
  })

  it('looks a country up case-insensitively and rejects an unknown one', () => {
    expect(demoCountry('sa')?.dial).toBe('966')
    expect(demoCountry('US')).toBeNull()
  })
})

describe('normalising a demo number', () => {
  it('builds E.164 from a national number', () => {
    const result = normalizeDemoPhone('SA', '0501234567')
    expect(result).toEqual({
      ok: true,
      phone: '+966501234567',
      country: demoCountry('SA'),
    })
  })

  it('strips spaces, dashes and leading zeros', () => {
    const result = normalizeDemoPhone('AE', '050 123 4567')
    expect(result.ok && result.phone).toBe('+971501234567')
  })

  it('accepts a number already written in international form', () => {
    expect(normalizeDemoPhone('EG', '+201001234567').ok).toBe(true)
    expect(normalizeDemoPhone('EG', '00201001234567').ok).toBe(true)
  })

  it('refuses a number that does not match the chosen country', () => {
    // Otherwise a form showing a Saudi flag dials an Egyptian number.
    expect(normalizeDemoPhone('SA', '+201001234567')).toEqual({
      ok: false,
      reason: 'country_mismatch',
    })
  })

  it('refuses an unknown country outright', () => {
    expect(normalizeDemoPhone('US', '+12125551234')).toEqual({
      ok: false,
      reason: 'unknown_country',
    })
  })

  it('refuses text, empty input and a number too short to be real', () => {
    expect(normalizeDemoPhone('SA', 'call me').ok).toBe(false)
    expect(normalizeDemoPhone('SA', '').ok).toBe(false)
    expect(normalizeDemoPhone('SA', '12').ok).toBe(false)
  })

  it('refuses a subscriber part that is too short even with a valid prefix', () => {
    const result = normalizeDemoPhone('EG', '+2012345')
    expect(result.ok).toBe(false)
  })
})

describe('demo throttling', () => {
  it('allows a first request', () => {
    expect(demoThrottle({ now: NOW, recentFromAddress: 0, lastForNumberAt: null })).toEqual({
      ok: true,
    })
  })

  it('refuses once one browser has asked too often', () => {
    expect(
      demoThrottle({
        now: NOW,
        recentFromAddress: DEMO_REQUESTS_PER_ADDRESS,
        lastForNumberAt: null,
      }),
    ).toEqual({ ok: false, reason: 'address_limit' })
  })

  it('refuses a repeat for the same number before the cooldown, from any browser', () => {
    // This is the limit that matters. Per-browser limiting only stops one
    // person clicking twice; per-number limiting is what stops this form
    // being used to ring a stranger's phone.
    const recent = new Date(NOW.getTime() - 60 * 60_000)
    expect(demoThrottle({ now: NOW, recentFromAddress: 0, lastForNumberAt: recent })).toEqual({
      ok: false,
      reason: 'number_cooldown',
    })
  })

  it('checks the number before the address, so the stronger rule wins', () => {
    const recent = new Date(NOW.getTime() - 60 * 60_000)
    expect(
      demoThrottle({
        now: NOW,
        recentFromAddress: DEMO_REQUESTS_PER_ADDRESS,
        lastForNumberAt: recent,
      }),
    ).toEqual({ ok: false, reason: 'number_cooldown' })
  })

  it('allows the number again once the cooldown has passed', () => {
    const old = new Date(NOW.getTime() - DEMO_NUMBER_COOLDOWN_MS - 1000)
    expect(demoThrottle({ now: NOW, recentFromAddress: 0, lastForNumberAt: old })).toEqual({
      ok: true,
    })
  })
})

describe('verifying gate eligibility', () => {
  const base = {
    now: NOW,
    expiresAt: new Date(NOW.getTime() + 5 * 60_000),
    attempts: 0,
    verifiedAt: null,
  }

  it('accepts an unverified request inside the window', () => {
    expect(verifyGate(base)).toEqual({ ok: true })
  })

  it('refuses after expiry', () => {
    expect(verifyGate({ ...base, expiresAt: new Date(NOW.getTime() - 1000) })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('refuses a request that never had an expiry date', () => {
    expect(verifyGate({ ...base, expiresAt: null })).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses once attempts are spent', () => {
    const spent = { ...base, attempts: DEMO_CODE_MAX_ATTEMPTS }
    expect(verifyGate(spent)).toEqual({ ok: false, reason: 'too_many_attempts' })
  })

  it('refuses a request already verified, so verification cannot be replayed', () => {
    expect(verifyGate({ ...base, verifiedAt: NOW })).toEqual({
      ok: false,
      reason: 'already_verified',
    })
  })
})

describe('fake-number heuristics', () => {
  it('rejects a number that is a real prefix followed by one repeated digit', () => {
    // The repetition sits after the mobile prefix, which is why a naive
    // "whole string is one digit" test misses exactly this case.
    expect(looksFake('+966500000000')).toEqual({ spam: true, reason: 'repeated_digits' })
    expect(looksFake('+966555555555')).toEqual({ spam: true, reason: 'repeated_digits' })
  })

  it('lets a near-miss through, and that is the intended trade', () => {
    // `511111112` has three distinct digits, so the rule does not fire. Widening
    // it to catch this would start refusing numbers real customers hold, and a
    // refused customer costs more than one throwaway that still has to pass
    // SMS verification before anything is dialled.
    expect(looksFake('+966511111112')).toEqual({ spam: false })
  })

  it('rejects a fully sequential subscriber number', () => {
    expect(looksFake('+966123456789')).toEqual({ spam: true, reason: 'sequential_digits' })
    expect(looksFake('+966987654321')).toEqual({ spam: true, reason: 'sequential_digits' })
  })

  it('accepts ordinary numbers, including ones with runs inside them', () => {
    // Refusing a real customer is far worse than letting a throwaway through,
    // so the rule only fires when the pattern runs the whole subscriber part.
    for (const phone of [
      '+966501234567',
      '+966555512345',
      '+201001234567',
      '+971509876543',
      '+966512983746',
    ]) {
      expect(looksFake(phone), `${phone} should be accepted`).toEqual({ spam: false })
    }
  })

  it('does not judge a number too short to have a subscriber part', () => {
    expect(looksFake('+9665000')).toEqual({ spam: false })
  })
})

describe('the platform-wide daily ceiling', () => {
  it('allows calls below the cap and refuses at it', () => {
    expect(withinGlobalDemoCap(0, 50)).toBe(true)
    expect(withinGlobalDemoCap(49, 50)).toBe(true)
    expect(withinGlobalDemoCap(50, 50)).toBe(false)
    expect(withinGlobalDemoCap(51, 50)).toBe(false)
  })

  it('refuses everything when the cap is zero — an off switch that works', () => {
    expect(withinGlobalDemoCap(0, 0)).toBe(false)
  })

  it('treats a negative cap as zero rather than as unlimited', () => {
    expect(withinGlobalDemoCap(0, -5)).toBe(false)
  })
})
