import { describe, expect, it } from 'vitest'
import {
  announcementMatchesAudience,
  canDismiss,
  compareAnnouncements,
  isAnnouncementLive,
  safeAnnouncementHref,
} from '@/lib/announcements'

const NOW = new Date('2026-09-01T12:00:00.000Z')
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000)

describe('isAnnouncementLive', () => {
  it('stays hidden while switched off, whatever the schedule says', () => {
    // The manual switch is checked first on purpose: an operator taking a
    // banner down during an incident must take effect immediately.
    expect(
      isAnnouncementLive({ isActive: false, startsAt: minutes(-60), endsAt: minutes(60) }, NOW),
    ).toBe(false)
  })

  it('shows an open-ended banner, because an incident has no known end', () => {
    expect(isAnnouncementLive({ isActive: true, startsAt: null, endsAt: null }, NOW)).toBe(true)
  })

  it('waits for a scheduled start', () => {
    expect(isAnnouncementLive({ isActive: true, startsAt: minutes(30), endsAt: null }, NOW)).toBe(
      false,
    )
  })

  it('disappears on its own at the end of its window', () => {
    // The point of scheduling: nobody has to be awake to take it down.
    expect(
      isAnnouncementLive({ isActive: true, startsAt: minutes(-60), endsAt: minutes(-1) }, NOW),
    ).toBe(false)
    expect(
      isAnnouncementLive({ isActive: true, startsAt: minutes(-60), endsAt: minutes(1) }, NOW),
    ).toBe(true)
  })

  it('treats the exact end instant as over', () => {
    expect(isAnnouncementLive({ isActive: true, startsAt: null, endsAt: NOW }, NOW)).toBe(false)
  })
})

describe('audience', () => {
  it('routes each banner to the surface it was written for', () => {
    expect(announcementMatchesAudience('public', 'public')).toBe(true)
    expect(announcementMatchesAudience('public', 'app')).toBe(false)
    expect(announcementMatchesAudience('app', 'app')).toBe(true)
    expect(announcementMatchesAudience('everyone', 'public')).toBe(true)
    expect(announcementMatchesAudience('everyone', 'app')).toBe(true)
  })
})

describe('canDismiss', () => {
  it('never lets a reader hide a critical notice', () => {
    // Otherwise a visitor can dismiss the outage banner and then wonder why
    // nothing works.
    expect(canDismiss({ severity: 'critical', dismissible: true })).toBe(false)
  })

  it('honours the editorial choice for everything else', () => {
    expect(canDismiss({ severity: 'warning', dismissible: true })).toBe(true)
    expect(canDismiss({ severity: 'info', dismissible: false })).toBe(false)
  })
})

describe('compareAnnouncements', () => {
  it('puts the outage above the promo', () => {
    const promo = { severity: 'info' as const, startsAt: minutes(-1) }
    const outage = { severity: 'critical' as const, startsAt: minutes(-600) }
    expect([promo, outage].sort(compareAnnouncements)[0]).toBe(outage)
  })

  it('prefers the most recent among equals', () => {
    const older = { severity: 'warning' as const, startsAt: minutes(-600) }
    const newer = { severity: 'warning' as const, startsAt: minutes(-5) }
    expect([older, newer].sort(compareAnnouncements)[0]).toBe(newer)
  })
})

describe('safeAnnouncementHref', () => {
  it('accepts internal paths', () => {
    expect(safeAnnouncementHref('/status')).toBe('/status')
  })

  it('rejects anything that leaves the site', () => {
    // A banner is operator-authored but appears on every page; an off-site
    // link here would be an open redirect with the site's own credibility.
    expect(safeAnnouncementHref('https://evil.example')).toBeNull()
    expect(safeAnnouncementHref('//evil.example')).toBeNull()
    expect(safeAnnouncementHref('javascript:alert(1)')).toBeNull()
    expect(safeAnnouncementHref('')).toBeNull()
    expect(safeAnnouncementHref(null)).toBeNull()
  })
})
