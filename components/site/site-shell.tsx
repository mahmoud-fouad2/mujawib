import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { copyFor } from '@/lib/content/site'
import type { Locale } from '@/lib/i18n'
import { getPlatformContact } from '@/server/data/platform'

/**
 * Marketing chrome. Direction is already set on <html> by the root layout, so
 * nothing here needs to know which way the page reads.
 *
 * `getPlatformContact` is request-deduped (`cache()`), so fetching it here —
 * the one place every marketing page passes through — costs one query no
 * matter how many other components on the same page also ask for it.
 */
export async function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const copy = copyFor(locale)
  const contact = await getPlatformContact()

  return (
    <div className="site">
      <SiteHeader locale={locale} copy={copy} />
      <main>{children}</main>
      <SiteFooter locale={locale} copy={copy} contact={contact} />
    </div>
  )
}
