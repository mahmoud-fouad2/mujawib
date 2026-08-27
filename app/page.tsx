import type { Metadata } from 'next'
import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'
import {
  JsonLd,
  organizationSchema,
  pageMetadata,
  serviceSchema,
  siteNavigationSchema,
  websiteSchema,
} from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/',
  title: 'مُجاوِب — موظف استقبال صوتي ذكي بالذكاء الاصطناعي | رد وحجز 24/7',
  description:
    'مُجاوِب يرد على مكالمات شركتك بالعربية على مدار الساعة، يفهم طلب العميل بلهجته المحلية، يحجز الموعد في تقويمك، ويرسل التأكيد فوراً عبر واتساب.',
})

export default function HomePage() {
  return (
    <SiteShell locale="ar">
      <JsonLd
        data={[
          organizationSchema('ar'),
          websiteSchema('ar'),
          serviceSchema('ar'),
          siteNavigationSchema('ar'),
        ]}
      />
      <Landing locale="ar" />
    </SiteShell>
  )
}
