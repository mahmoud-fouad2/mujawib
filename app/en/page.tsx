import type { Metadata } from 'next'
import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'
import { JsonLd, organizationSchema, pageMetadata, serviceSchema, websiteSchema } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/',
  title: 'Arabic voice reception that answers and books',
  description:
    'Mujawib answers your business calls in Arabic around the clock, understands the request, books the slot in your calendar and sends the confirmation — handing over to a person when needed.',
})

export default function EnglishHomePage() {
  return (
    <SiteShell locale="en">
      <JsonLd data={[organizationSchema('en'), websiteSchema('en'), serviceSchema('en')]} />
      <Landing locale="en" />
    </SiteShell>
  )
}
