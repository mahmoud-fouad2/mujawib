import type { Metadata } from 'next'
import { SecurityPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/security',
  title: 'Reliability',
  description: 'Tenant isolation, role-scoped access, an audit log, and retention you control.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <SecurityPage locale="en" />
    </SiteShell>
  )
}
