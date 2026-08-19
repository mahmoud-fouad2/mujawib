import type { Metadata } from 'next'
import { HowItWorksPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/how-it-works',
  title: 'How we start',
  description: 'Four stages from first call to launch, and what is asked of you in each.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <HowItWorksPage locale="en" />
    </SiteShell>
  )
}
