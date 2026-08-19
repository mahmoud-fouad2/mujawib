import type { Metadata } from 'next'
import { PricingPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/pricing',
  title: 'Pricing',
  description: 'Pricing follows call volume, not seats. Three clear bands with no setup fee.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <PricingPage locale="en" />
    </SiteShell>
  )
}
