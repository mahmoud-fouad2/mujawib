import { ArrowLeft, ArrowRight } from 'lucide-react'
import { CallPlayer } from '@/components/site/call-player'
import { Industries } from '@/components/site/industries'
import {
  Capabilities,
  CloseCta,
  ConsolePreview,
  DemoCalls,
  IntegrationWires,
  ProofStrip,
  Results,
  TrustRow,
  WhyRows,
} from '@/components/site/sections'
import { LinkButton } from '@/components/ui/button'
import { copyFor } from '@/lib/content/site'
import { CALL_OUTCOME_LABEL, clock } from '@/lib/format'
import { isRtl, type Locale, localePath } from '@/lib/i18n'
import { buildRecordItems } from '@/lib/record'
import {
  getConsolePreview,
  getDemoCalls,
  getHeroCall,
  getIndustryPacks,
  getLiveIntegrations,
  getPlatformProof,
  getReferenceClients,
} from '@/server/data/marketing'
import { isDatabaseUnavailable } from '@/server/db'

export async function Landing({ locale }: { locale: Locale }) {
  const copy = copyFor(locale)
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

  const data = await Promise.all([
    getPlatformProof(),
    getHeroCall(),
    getDemoCalls(),
    getIndustryPacks(),
    getLiveIntegrations(),
    getReferenceClients(),
    getConsolePreview(),
  ]).catch((error: unknown) => {
    if (!isDatabaseUnavailable(error)) throw error
    console.error('[marketing] operational data unavailable')
    return null
  })
  const proof = data?.[0] ?? null
  const hero = data?.[1] ?? null
  const demos = data?.[2] ?? []
  const packs = data?.[3] ?? []
  const integrations = data?.[4] ?? []
  const clients = data?.[5] ?? []
  const consolePreview = data?.[6] ?? {
    queue: [],
    counts: { live: 0, review: 0, degraded: 0 },
  }

  // Tool executions carry an absolute time; place them on the call's own clock
  // so the player fires them at the moment they actually ran.
  const heroToolEvents = hero
    ? buildRecordItems(hero.turns, hero.tools, hero.durationSeconds)
        .filter((i): i is Extract<typeof i, { kind: 'tool' }> => i.kind === 'tool')
        .map((i) => ({ name: i.name, success: i.success, latencyMs: i.latencyMs, at: i.at }))
    : []
  const heroOutcome = hero?.booking?.service
    ? {
        label:
          locale === 'ar'
            ? `تم الحجز — ${hero.booking.service}`
            : `Booked — ${hero.booking.service}`,
        detail: clock(hero.booking.scheduledAt),
      }
    : null

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <span className="hero__eyebrow">
              <span
                className="pill__dot"
                aria-hidden="true"
                style={{ background: 'var(--signal)' }}
              />
              {copy.hero.eyebrow}
            </span>

            <h1>
              {copy.hero.title}
              <br />
              <em>{copy.hero.titleMuted}</em>
            </h1>

            <p className="hero__lead">{copy.hero.lead}</p>

            <div className="hero__actions">
              <LinkButton
                href={localePath(locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {copy.hero.primary}
              </LinkButton>
              <LinkButton href="#calls" size="lg">
                {copy.hero.secondary}
              </LinkButton>
            </div>

            <p className="hero__note">{copy.hero.note}</p>

            {proof ? <ProofStrip copy={copy} proof={proof} /> : null}
          </div>

          {hero ? (
            <CallPlayer
              locale={locale}
              title={copy.hero.recordTitle}
              meta={`${hero.workspaceName} · ${copy.hero.recordMeta}`}
              turns={hero.turns}
              tools={heroToolEvents}
              totalSeconds={hero.durationSeconds ?? 60}
              outcome={heroOutcome ?? undefined}
            />
          ) : null}
        </div>
      </section>

      <TrustRow
        label={copy.trust.label}
        caption={copy.trust.caption}
        names={clients.map((c) => c.name)}
      />

      <DemoCalls
        locale={locale}
        copy={copy}
        calls={demos.map((d) => ({
          id: d.id,
          workspaceName: d.workspaceName,
          intent: d.intent,
          outcome: d.outcome ? (CALL_OUTCOME_LABEL[d.outcome] ?? d.outcome) : null,
          durationSeconds: d.durationSeconds,
          turns: d.turns,
        }))}
      />

      <Capabilities copy={copy} />

      <WhyRows copy={copy} />

      {packs.length > 0 ? (
        <section className="section section--tinted reveal" id="industries">
          <div className="container">
            <header className="section__head">
              <span className="section__label">{copy.industries.label}</span>
              <div>
                <h2 className="section__title">{copy.industries.title}</h2>
                <p className="section__lead">{copy.industries.lead}</p>
              </div>
            </header>
            <Industries
              locale={locale}
              copy={copy}
              packs={packs.map((p) => ({
                packKey: p.packKey,
                name: p.name,
                version: p.version,
                clients: p.clients,
                flows: (p.defaultFlows ?? []) as string[],
              }))}
            />
          </div>
        </section>
      ) : null}

      <Results copy={copy} />

      {integrations.length > 0 ? (
        <IntegrationWires
          locale={locale}
          copy={copy}
          providers={integrations.map((i) => ({ provider: i.provider, label: i.label }))}
        />
      ) : null}

      <ConsolePreview
        locale={locale}
        copy={copy}
        queue={consolePreview.queue}
        counts={consolePreview.counts}
      />

      <CloseCta locale={locale} copy={copy} />
    </>
  )
}
