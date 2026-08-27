import type { Metadata } from 'next'
import { PricingPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pagesFor } from '@/lib/content/pages'
import { breadcrumbSchema, faqSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/pricing',
  title: 'الأسعار والباقات — تكلفة موظف الاستقبال الصوتي الذكي | مُجاوِب',
  description:
    'باقات تسعير مرنة تعتمد على حجم مكالماتك الشهرية دون رسوم إعداد أو التزامات خفية، مع خدمة مُدارة بالكامل 24/7.',
})

export default function Page() {
  const p = pagesFor('ar').pricing

  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'الأسعار والباقات', path: '/pricing' },
          ]),
          faqSchema(p.faq),
        ]}
      />
      <PricingPage locale="ar" />
    </SiteShell>
  )
}
