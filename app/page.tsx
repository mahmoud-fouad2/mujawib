import { Landing } from '@/components/site/landing'
import { SiteShell } from '@/components/site/site-shell'

export default function HomePage() {
  return (
    <SiteShell locale="ar">
      <Landing locale="ar" />
    </SiteShell>
  )
}
