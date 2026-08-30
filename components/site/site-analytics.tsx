'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import type { Locale } from '@/lib/i18n'

type Beacon = { type: 'page_view' | 'cta_click'; path: string; ctaId?: string; locale: Locale }

/**
 * Fire-and-forget by design — nothing here may block or delay rendering,
 * and a beacon that fails (ad blocker, offline) silently drops rather than
 * retrying, same as any other analytics beacon.
 */
function send(body: Beacon) {
  try {
    const payload = JSON.stringify(body)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }))
    } else {
      fetch('/api/track', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
    }
  } catch {
    // Analytics must never be the reason a page errors.
  }
}

/**
 * Mounted once in SiteShell. Page views fire on mount and on every
 * client-side route change; CTA clicks use event delegation on a
 * `data-cta="..."` attribute rather than an onClick prop, so any marketing
 * page or component — server-rendered or not — can opt a button or link
 * into tracking with a plain HTML attribute, no client-boundary plumbing.
 */
export function SiteAnalytics({ locale }: { locale: Locale }) {
  const pathname = usePathname()

  useEffect(() => {
    send({ type: 'page_view', path: pathname, locale })
  }, [pathname, locale])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const ctaId = target.closest('[data-cta]')?.getAttribute('data-cta')
      if (ctaId) send({ type: 'cta_click', path: window.location.pathname, ctaId, locale })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [locale])

  return null
}
