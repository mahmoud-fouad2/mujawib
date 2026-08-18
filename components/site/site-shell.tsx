import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { copyFor } from '@/lib/content/site'
import type { Locale } from '@/lib/i18n'

/**
 * Marketing chrome. Direction is already set on <html> by the root layout, so
 * nothing here needs to know which way the page reads.
 */
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const copy = copyFor(locale)

  return (
    <div className="site">
      <SiteHeader locale={locale} copy={copy} />
      <main>{children}</main>
      <SiteFooter locale={locale} copy={copy} />
    </div>
  )
}
