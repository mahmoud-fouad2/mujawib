import type { Metadata } from 'next'
import { AboutPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/about',
  title: 'من نحن',
  description: 'لماذا بنينا مُجاوِب، وما المبادئ الأربعة التي لا نتنازل عنها في جودة الصوت العربي.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <AboutPage locale="ar" />
    </SiteShell>
  )
}
