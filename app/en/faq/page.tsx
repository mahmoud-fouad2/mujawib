import type { Metadata } from 'next'
import { FaqPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/faq',
  title: 'Frequently Asked Questions — Arabic Voice AI Receptionist | Mujawib',
  description:
    'Clear answers about deployment timelines, dialect comprehension, calendar & WhatsApp integrations, and enterprise reliability.',
})

export default function Page() {
  const items = pagesFor('en').faq.groups.flatMap((g) => g.items)

  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          faqSchema(items),
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'FAQ', path: '/en/faq' },
          ]),
        ]}
      />
      <FaqPage locale="en" />
    </SiteShell>
  )
}
