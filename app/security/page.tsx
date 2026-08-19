import type { Metadata } from 'next'
import { SecurityPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/security',
  title: 'الموثوقية والأمان',
  description: 'عزل بيانات كل عميل، صلاحيات حسب الدور، سجل تدقيق، وسياسة احتفاظ تتحكم بها.',
})

export default function Page() {
  return (
    <SiteShell locale="ar">
      <SecurityPage locale="ar" />
    </SiteShell>
  )
}
