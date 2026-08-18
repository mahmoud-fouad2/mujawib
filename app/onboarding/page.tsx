import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/auth/onboarding-wizard'
import { requireSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { industryTemplate } from '@/server/db/schema'

export const metadata: Metadata = { title: 'تهيئة مساحة عمل' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  await requireSession('/onboarding')

  // Packs come from the same table the console reads — one source of truth.
  const rows = await db.select().from(industryTemplate).orderBy(industryTemplate.name)

  const packs = rows.map((r) => ({
    packKey: r.packKey,
    name: r.name,
    version: r.version,
    flows: ((r.defaultFlows as string[]) ?? []).filter(Boolean),
    integrations: ((r.defaultIntegrations as string[]) ?? []).filter(Boolean),
  }))

  return <OnboardingWizard packs={packs} />
}
