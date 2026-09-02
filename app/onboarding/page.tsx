import { and, eq, isNotNull } from 'drizzle-orm'
import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/auth/onboarding-wizard'
import { dialectLabel, personaByKey } from '@/lib/voice-personas'
import { requireSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { industryTemplate, voiceProfile } from '@/server/db/schema'

export const metadata: Metadata = { title: 'تهيئة مساحة عمل' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  await requireSession('/onboarding')

  // Packs come from the same table the console reads — one source of truth.
  // The same is true of personas: these are the rows migration 0026 seeded,
  // not a copy of the constant, so a persona an operator has since renamed or
  // retired shows here exactly as it is.
  const [rows, personaRows] = await Promise.all([
    db.select().from(industryTemplate).orderBy(industryTemplate.name),
    db
      .select({
        personaKey: voiceProfile.personaKey,
        name: voiceProfile.name,
        dialect: voiceProfile.dialect,
        gender: voiceProfile.gender,
        language: voiceProfile.language,
        sortOrder: voiceProfile.sortOrder,
      })
      .from(voiceProfile)
      .where(and(eq(voiceProfile.isGlobal, true), isNotNull(voiceProfile.personaKey)))
      .orderBy(voiceProfile.sortOrder)
      .limit(30),
  ])

  const personas = personaRows.flatMap((row) => {
    if (!row.personaKey) return []
    return [
      {
        key: row.personaKey,
        name: row.name,
        description: personaByKey(row.personaKey)?.description ?? '',
        gender: (row.gender ?? 'female') as 'male' | 'female',
        language: row.language,
        dialectLabel: dialectLabel(row.dialect),
      },
    ]
  })

  const packs = rows.map((r) => ({
    packKey: r.packKey,
    name: r.name,
    version: r.version,
    flows: ((r.defaultFlows as string[]) ?? []).filter(Boolean),
    integrations: ((r.defaultIntegrations as string[]) ?? []).filter(Boolean),
  }))

  return <OnboardingWizard packs={packs} personas={personas} />
}
