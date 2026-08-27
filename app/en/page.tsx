import type { Metadata } from 'next'
import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'
import { JsonLd, organizationSchema, pageMetadata, serviceSchema, websiteSchema } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/',
  title: 'Enterprise Arabic Voice AI Receptionist | 24/7 Call Automation',
  description:
    'Mujawib answers inbound business calls in natural Arabic dialects around the clock, books calendar appointments, sends instant WhatsApp confirmations, and syncs CRM data.',
})

export default function EnglishHomePage() {
  return (
    <SiteShell locale="en">
      <JsonLd data={[organizationSchema('en'), websiteSchema('en'), serviceSchema('en')]} />
      <Landing locale="en" />
    </SiteShell>
  )
}
