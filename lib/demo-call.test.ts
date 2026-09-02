import { describe, expect, it } from 'vitest'
import {
  DEMO_COUNTRIES,
  DEMO_NUMBER_COOLDOWN_MS,
  DEMO_REQUESTS_PER_ADDRESS,
  demoCountry,
  demoThrottle,
  normalizeDemoPhone,
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
