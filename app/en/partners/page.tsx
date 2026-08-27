import type { Metadata } from 'next'
import { PartnersPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/partners',
  title: 'Partner Program & Agency Solutions — Recurring Voice AI Revenue | Mujawib',
  description:
    'Partner with Mujawib to deliver Arabic voice AI receptionist solutions to your clients. Earn 20% to 30% monthly recurring commissions with full engineering backing.',
})

export default function Page() {
  const p = pagesFor('en').partners

  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Partners', path: '/en/partners' },
          ]),
          faqSchema(p.faq),
        ]}
      />
      <PartnersPage locale="en" />
    </SiteShell>
  )
}
