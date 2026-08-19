import type { Metadata } from 'next'
import { ContactPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/contact',
  title: 'Contact',
  description:
    'Talk to the Mujawib team by email, phone or WhatsApp. We start with a call to understand your business.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <ContactPage locale="en" />
    </SiteShell>
  )
}
