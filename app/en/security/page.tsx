import type { Metadata } from 'next'
import { SecurityPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/security',
  title: 'Security, Privacy & PDPL Compliance | Mujawib',
  description:
    '100% database tenant isolation, AES-256 and TLS 1.3 encryption, Saudi PDPL compliance, and configurable data retention policies.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Security & Privacy', path: '/en/security' },
          ]),
        ]}
      />
      <SecurityPage locale="en" />
    </SiteShell>
  )
}
