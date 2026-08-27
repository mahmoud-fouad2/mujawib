import type { Metadata } from 'next'
import { HowItWorksPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/how-it-works',
  title: 'كيف نبدأ معك — 4 خطوات لتشغيل الموظف الصوتي لشركتك | مُجاوِب',
  description:
    'من أول مكالمة استكشافية إلى إطلاق موظفك الصوتي الذكي في 4 مراحل واضحة: نفهم عملك، ندرّب النبرة والسيناريو، نربط التقويم، ونبدأ التشغيل.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'كيف نبدأ معك', path: '/how-it-works' },
          ]),
        ]}
      />
      <HowItWorksPage locale="ar" />
    </SiteShell>
  )
}
