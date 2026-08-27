import type { Metadata } from 'next'
import { PartnersPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/partners',
  title: 'برنامج الشركاء والوكالات — أرباح شهرية متكررة بحلول الذكاء الصوتي | مُجاوِب',
  description:
    'انضم لبرنامج شركاء مُجاوِب واربح عمولات شهرية متكررة مستمرة تبدأ من 20% أو أعد بيع الخدمة لوكالتك، مع خدمة تشغيل مُدارة بالكامل 24/7.',
})

export default function Page() {
  const p = pagesFor('ar').partners

  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'برنامج الشركاء', path: '/partners' },
          ]),
          faqSchema(p.faq),
        ]}
      />
      <PartnersPage locale="ar" />
    </SiteShell>
  )
}
