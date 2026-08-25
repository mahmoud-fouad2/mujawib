import type { Metadata } from 'next'
import { PartnersPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/partners',
  title: 'Partners',
  description:
    'Join the Mujawib partner program and deliver exceptional voice AI experiences to your clients.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <PartnersPage locale="en" />
    </SiteShell>
  )
}
