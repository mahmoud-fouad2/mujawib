import type { Metadata } from 'next'
import { PricingPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/pricing',
  title: 'Pricing & Plans — Transparent Voice AI Tiers | Mujawib',
  description:
    'Transparent volume-based pricing with zero setup fees. Fully managed Arabic voice AI reception, calendar sync, and WhatsApp automation.',
})

export default function Page() {
  const p = pagesFor('en').pricing

  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Pricing', path: '/en/pricing' },
          ]),
          faqSchema(p.faq),
        ]}
      />
      <PricingPage locale="en" />
    </SiteShell>
  )
}
