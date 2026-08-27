import type { Metadata } from 'next'
import { SecurityPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/security',
  title: 'الأمان والموثوقية — حماية البيانات والامتثال لنظام PDPL | مُجاوِب',
  description:
    'عزل قواعد البيانات بنسبة 100%، تشفير متقدم AES-256 و TLS 1.3، امتثال لنظام حماية البيانات الشخصية السعودي، وسياسات احتفاظ مرنة.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'الأمان والموثوقية', path: '/security' },
          ]),
        ]}
      />
      <SecurityPage locale="ar" />
    </SiteShell>
  )
}
