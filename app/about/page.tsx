import type { Metadata } from 'next'
import { AboutPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/about',
  title: 'عن مُجاوِب — رؤيتنا ومبادئنا في تشغيل الصوت العربي الذكي | مُجاوِب',
  description:
    'تعرف على قصة مُجاوِب ومبادئنا الهندسية في صياغة أول موظف استقبال صوتي ذكي يفهم اللهجات العربية بعمق ويدعم نمو الشركات في المنطقة.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'من نحن', path: '/about' },
          ]),
        ]}
      />
      <AboutPage locale="ar" />
    </SiteShell>
  )
}
