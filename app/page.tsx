import type { Metadata } from 'next'
import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'
import { JsonLd, organizationSchema, pageMetadata, serviceSchema, websiteSchema } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/',
  title: 'مُجاوِب — موظف استقبال صوتي عربي يرد ويحجز',
  description:
    'مُجاوِب يرد على مكالمات شركتك بالعربية على مدار الساعة، يفهم طلب العميل، يحجز الموعد في تقويمك، ويرسل التأكيد — ويحوّل للموظف عند الحاجة.',
})

export default function HomePage() {
  return (
    <SiteShell locale="ar">
      <JsonLd data={[organizationSchema('ar'), websiteSchema('ar'), serviceSchema('ar')]} />
      <Landing locale="ar" />
    </SiteShell>
  )
}
