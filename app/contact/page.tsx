import type { Metadata } from 'next'
import { ContactPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/contact',
  title: 'تواصل معنا',
  description: 'تحدّث مع فريق مُجاوِب: بريد، هاتف، وواتساب — ونبدأ بمكالمة نفهم فيها عملك.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <ContactPage locale="ar" />
    </SiteShell>
  )
}
