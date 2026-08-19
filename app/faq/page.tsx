import type { Metadata } from 'next'
import { FaqPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/faq',
  title: 'الأسئلة الشائعة',
  description: 'مدة التشغيل، جودة الصوت العربي، الحجز في التقويم، والتعامل مع الأعطال.',
})

export default function Page() {
  const items = pagesFor('ar').faq.groups.flatMap((g) => g.items)

  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          faqSchema(items),
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'الأسئلة الشائعة', path: '/faq' },
          ]),
        ]}
      />
      <FaqPage locale="ar" />
    </SiteShell>
  )
}
