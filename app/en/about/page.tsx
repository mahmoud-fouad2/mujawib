import type { Metadata } from 'next'
import { AboutPage } from '@/components/site/pages'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/about',
  title: 'About',
  description: 'Why we built Mujawib, and the four principles we do not bend on.',
})

export default function Page() {
  return (
    <SiteShell locale="en">
      <AboutPage locale="en" />
    </SiteShell>
  )
}
