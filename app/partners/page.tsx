import type { Metadata } from 'next'
import { PartnersPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/partners',
  title: 'الشركاء',
  description:
    'انضم لبرنامج شركاء مجاوب واستفد من حلول الذكاء الاصطناعي الصوتي لخدمة عملائك وزيادة أرباحك.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <PartnersPage locale="ar" />
    </SiteShell>
  )
}
