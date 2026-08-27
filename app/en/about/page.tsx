import type { Metadata } from 'next'
import { AboutPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/about',
  title: 'About Us — Arabic Speech Engineering & Core Principles | Mujawib',
  description:
    'Discover why we built Mujawib and our four engineering principles behind enterprise-grade Arabic conversational AI for businesses.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'About Us', path: '/en/about' },
          ]),
        ]}
      />
      <AboutPage locale="en" />
    </SiteShell>
  )
}
