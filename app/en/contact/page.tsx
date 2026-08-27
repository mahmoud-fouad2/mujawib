import type { Metadata } from 'next'
import { ContactPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, contactPageSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/contact',
  title: 'Contact Us — Book a Discovery Consultation & Live Demo | Mujawib',
  description:
    'Speak directly with Mujawib AI engineers via phone, email, or WhatsApp. We start with a tailored consultation to model voice reception for your business.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Contact Us', path: '/en/contact' },
          ]),
          contactPageSchema('en'),
        ]}
      />
      <ContactPage locale="en" />
    </SiteShell>
  )
}
