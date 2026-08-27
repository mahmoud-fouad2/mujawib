import type { Metadata } from 'next'
import { ContactPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, contactPageSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/contact',
  title: 'تواصل معنا — احجز استشارة وتجربة اتصال حية | مُجاوِب',
  description:
    'تحدث مباشرة مع مستشاري مُجاوِب عبر الهاتف، البريد، أو واتساب. نبدأ بجلسة سريعة لفهم نشاطك واختبار الموظف الصوتي مباشرة على رقمك.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'تواصل معنا', path: '/contact' },
          ]),
          contactPageSchema('ar'),
        ]}
      />
      <ContactPage locale="ar" />
    </SiteShell>
  )
}
