import type { Metadata } from 'next'
import { HowItWorksPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/how-it-works',
  title: 'How It Works — 4-Step Voice AI Deployment | Mujawib',
  description:
    'From initial discovery to full autonomous operation in four proven steps: business mapping, dialect tuning, calendar integration, and live deployment.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'How It Works', path: '/en/how-it-works' },
          ]),
        ]}
      />
      <HowItWorksPage locale="en" />
    </SiteShell>
  )
}
