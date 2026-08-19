import type { Metadata } from 'next'
import { FaqPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/faq',
  title: 'FAQ',
  description:
    'Time to launch, Arabic voice quality, calendar booking, and how failures are handled.',
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
