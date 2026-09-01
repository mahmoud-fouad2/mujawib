'use client'

import { useEffect, useState } from 'react'
import { canDismiss } from '@/lib/announcements'
import type { LiveAnnouncement } from '@/server/data/content'

/**
 * The one banner shown site-wide, above everything else.
 *
 * Client-side only for the dismissal, which is stored per browser: a reader
 * who has already acknowledged a notice should not meet it on every page, and
 * a critical incident cannot be dismissed at all (`canDismiss`), so the state
 * below can never hide something the reader needs.
 *
 * The banner renders on the server first with its content in the HTML — it is
 * not fetched — so a maintenance notice is present for a crawler and for a
 * reader with no JavaScript. Dismissal is the only part that needs the client.
 */

const STORAGE_PREFIX = 'mujawib.announcement.'

export function AnnouncementBanner({
  announcement,
  locale,
}: {
  announcement: LiveAnnouncement
  locale: 'ar' | 'en'
}) {
  const dismissible = canDismiss(announcement)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!dismissible) return
    try {
      setHidden(window.localStorage.getItem(`${STORAGE_PREFIX}${announcement.id}`) === 'dismissed')
    } catch {
      // A browser with storage blocked simply keeps seeing the banner, which
      // is the safer of the two failure directions.
    }
  }, [announcement.id, dismissible])

  if (hidden) return null

  const title =
    locale === 'en' && announcement.titleEn ? announcement.titleEn : announcement.titleAr
  const body = locale === 'en' && announcement.bodyEn ? announcement.bodyEn : announcement.bodyAr

  const dismiss = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${announcement.id}`, 'dismissed')
    } catch {
      // Hiding for this page view only is an acceptable degradation.
    }
  }

  return (
    <div
      className={`announce announce--${announcement.severity}`}
      role={announcement.severity === 'critical' ? 'alert' : 'status'}
    >
      <div className="announce__inner">
        <span className="announce__dot" aria-hidden="true" />
        <div className="announce__text">
          <strong>{title}</strong>
          {body ? <span>{body}</span> : null}
        </div>
        {announcement.href ? (
          <a className="announce__link" href={announcement.href}>
            {locale === 'en' ? 'Details' : 'التفاصيل'}
          </a>
        ) : null}
        {dismissible ? (
          <button
            type="button"
            className="announce__close"
            onClick={dismiss}
            aria-label={locale === 'en' ? 'Dismiss' : 'إخفاء'}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )
}
