import type { Metadata } from 'next'
import { ContactPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { env } from '@/lib/env'
import { breadcrumbSchema, contactPageSchema, JsonLd, pageMetadata } from '@/lib/seo'
import { getPlatformContact } from '@/server/data/platform'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/contact',
  title: 'Contact Us — Book a Discovery Consultation & Live Demo | Mujawib',
  description:
    'Speak directly with Mujawib AI engineers via phone, email, or WhatsApp. We start with a tailored consultation to model voice reception for your business.',
})

export default async function Page() {
  const contact = await getPlatformContact()
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Contact Us', path: '/en/contact' },
          ]),
          contactPageSchema('en', contact),
        ]}
      />
      <ContactPage locale="en" contact={contact} recaptchaSiteKey={env.RECAPTCHA_SITE_KEY} />
    </SiteShell>
  )
}
