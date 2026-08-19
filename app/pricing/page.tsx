import type { Metadata } from 'next'
import { PricingPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/pricing',
  title: 'الأسعار',
  description: 'السعر يتبع حجم مكالماتك، لا عدد المستخدمين. ثلاث نطاقات واضحة بدون رسوم إعداد.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <PricingPage locale="ar" />
    </SiteShell>
  )
}
