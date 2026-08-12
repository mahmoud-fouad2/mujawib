import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import {
  Sectors,
  Outcomes,
  DashboardPreview,
  WhyMujawib,
  HowItWorks,
  Integrations,
} from '@/components/landing/marketing-sections'
import { Templates, CtaBanner, SiteFooter } from '@/components/landing/templates-cta'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bgColor-default)' }}>
      <SiteHeader />
      <Hero />
      <Sectors />
      <Outcomes />
      <DashboardPreview />
      <WhyMujawib />
      <HowItWorks />
      <Integrations />
      <Templates />
      <CtaBanner />
      <SiteFooter />
    </main>
  )
}
