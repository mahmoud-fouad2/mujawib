import type {
  AnnouncementAudience,
  AnnouncementKind,
  AnnouncementSeverity,
} from '@/server/db/schema/content'

/**
 * Pure rules for whether a banner is showing, kept out of the data layer so
 * both the reader and the operator preview agree without a database round
 * trip — and so the scheduling logic is testable on its own.
 */

export const ANNOUNCEMENT_KIND_LABEL: Record<AnnouncementKind, string> = {
  maintenance: 'صيانة مجدولة',
  incident: 'عُطل حالي',
  notice: 'إشعار',
  promo: 'إعلان',
}

export const ANNOUNCEMENT_SEVERITY_LABEL: Record<AnnouncementSeverity, string> = {
  info: 'معلومة',
  warning: 'تنبيه',
  critical: 'حرج',
}

export const ANNOUNCEMENT_AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  public: 'الموقع العام فقط',
  app: 'الكونسول والبورتال فقط',
  everyone: 'الجميع',
}

export type AnnouncementWindow = {
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
}

/**
 * Live means: switched on, started, and not finished.
 *
 * `isActive` is the manual switch and is checked first — an operator turning
 * a banner off during an incident must take effect immediately, whatever the
 * schedule says. An open-ended window (`endsAt` null) is deliberate: an
 * incident does not have a known end time when it is declared.
 */
export function isAnnouncementLive(item: AnnouncementWindow, now: Date = new Date()): boolean {
  if (!item.isActive) return false
  if (item.startsAt && item.startsAt.getTime() > now.getTime()) return false
  if (item.endsAt && item.endsAt.getTime() <= now.getTime()) return false
  return true
}

/** Whether a banner belongs on the surface currently rendering. */
export function announcementMatchesAudience(
  audience: AnnouncementAudience,
  surface: 'public' | 'app',
): boolean {
  return audience === 'everyone' || audience === surface
}

/**
 * Severity order, most severe first.
 *
 * Only one banner is ever shown. Stacking them buries the one that matters,
 * and the one that matters during an outage is the outage — not the promo
 * that happens to be scheduled at the same time.
 */
const SEVERITY_RANK: Record<AnnouncementSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function compareAnnouncements(
  a: { severity: AnnouncementSeverity; startsAt: Date | null },
  b: { severity: AnnouncementSeverity; startsAt: Date | null },
): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (bySeverity !== 0) return bySeverity
  // Then the most recently started, so a fresh notice replaces a stale one.
  return (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0)
}

/**
 * A critical banner is never dismissible, whatever the row says.
 *
 * The flag is an editorial choice for notices and promos; for an active
 * incident it would let a reader hide the one thing the page needs to tell
 * them, and then wonder why nothing works.
 */
export function canDismiss(item: {
  severity: AnnouncementSeverity
  dismissible: boolean
}): boolean {
  return item.severity !== 'critical' && item.dismissible
}

/** Internal paths only — an announcement must not be able to point off-site. */
export function safeAnnouncementHref(href: string | null | undefined): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  return trimmed.slice(0, 200)
}
