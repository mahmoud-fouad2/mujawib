import type { Metadata } from 'next'
import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'

export const metadata: Metadata = {
  // Absolute so the Arabic title template does not append to English pages.
  title: { absolute: 'Mujawib — Arabic voice operations for business' },
  description:
    'A managed B2B platform for Arabic voice reception and customer service: structured agent setup, tested Arabic voice quality, and real booking and system integration.',
}

export default function EnglishHomePage() {
  return (
    <SiteShell locale="en">
      <Landing locale="en" />
    </SiteShell>
  )
}
