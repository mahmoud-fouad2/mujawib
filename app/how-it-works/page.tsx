import type { Metadata } from 'next'
import { HowItWorksPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/how-it-works',
  title: 'كيف نبدأ',
  description: 'أربع مراحل من أول مكالمة إلى التشغيل، وما المطلوب منك في كل مرحلة.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <HowItWorksPage locale="ar" />
    </SiteShell>
  )
}
