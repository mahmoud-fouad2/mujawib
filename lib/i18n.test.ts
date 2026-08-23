import { describe, expect, it } from 'vitest'
import { dirOf, isRtl, localePath, switchLocalePath } from './i18n'

describe('dirOf / isRtl', () => {
  it('marks Arabic as RTL', () => {
    expect(dirOf('ar')).toBe('rtl')
    expect(isRtl('ar')).toBe(true)
  })

  it('marks English as LTR', () => {
    expect(dirOf('en')).toBe('ltr')
    expect(isRtl('en')).toBe(false)
  })
})

describe('localePath', () => {
  it('leaves Arabic paths bare — it is the root locale', () => {
    expect(localePath('ar', '/pricing')).toBe('/pricing')
    expect(localePath('ar', '/')).toBe('/')
  })

  it('prefixes English paths with /en', () => {
    expect(localePath('en', '/pricing')).toBe('/en/pricing')
    expect(localePath('en', '/')).toBe('/en')
  })

  it('adds a leading slash to a bare path', () => {
    expect(localePath('en', 'pricing')).toBe('/en/pricing')
  })

  it('passes same-page anchors through untouched, in either locale', () => {
    expect(localePath('en', '#pricing')).toBe('#pricing')
    expect(localePath('ar', '#pricing')).toBe('#pricing')
  })

  it('passes absolute and mailto links through untouched', () => {
    expect(localePath('en', 'https://example.com')).toBe('https://example.com')
    expect(localePath('en', 'mailto:hi@example.com')).toBe('mailto:hi@example.com')
  })

  /**
   * Surfaces that exist once — console, portal, auth, api — must never gain
   * an /en twin. Prefixing them would produce dead links like /en/sign-in.
   */
  it('never prefixes shared app surfaces, even under the English locale', () => {
    expect(localePath('en', '/console')).toBe('/console')
    expect(localePath('en', '/console/clients')).toBe('/console/clients')
    expect(localePath('en', '/sign-in')).toBe('/sign-in')
    expect(localePath('en', '/portal/calls')).toBe('/portal/calls')
  })

  it('does not treat a path that merely starts with a shared prefix as shared', () => {
    // "/consolexyz" is not "/console" — must not false-positive on startsWith.
    expect(localePath('en', '/consolexyz')).toBe('/en/consolexyz')
  })
})

describe('switchLocalePath', () => {
  it('moves an Arabic path to its English twin', () => {
    expect(switchLocalePath('/pricing', 'en')).toBe('/en/pricing')
  })

  it('moves an English path back to Arabic', () => {
    expect(switchLocalePath('/en/pricing', 'ar')).toBe('/pricing')
  })

  it('round-trips the English home page', () => {
    expect(switchLocalePath('/en', 'ar')).toBe('/')
    expect(switchLocalePath('/', 'en')).toBe('/en')
  })

  it('keeps a shared surface unprefixed when switching from English', () => {
    expect(switchLocalePath('/console', 'en')).toBe('/console')
  })
})
