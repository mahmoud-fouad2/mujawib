import { ArrowLeft, ArrowRight } from 'lucide-react'
import { CallPlayer } from '@/components/site/call-player'
import { Industries } from '@/components/site/industries'
import {
  ArabicFirst,
  Capabilities,
  CloseCta,
  ConsolePreview,
  DemoCalls,
  FailureHandling,
  IntegrationWires,
  OutcomeStory,
  ProofStrip,
} from '@/components/site/sections'
import { LinkButton } from '@/components/ui/button'
import { copyFor } from '@/lib/content/site'
import { intentLabel, outcomeLabel } from '@/lib/content/vocabulary'
import { clock } from '@/lib/format'
import { isRtl, type Locale, localePath } from '@/lib/i18n'
import { buildRecordItems } from '@/lib/record'
import {
  getConsolePreview,
  getDemoCalls,
  getHeroCall,
  getIndustryPacks,
  getLiveIntegrations,
  getPlatformProof,
} from '@/server/data/marketing'
import { isDatabaseUnavailable } from '@/server/db'

const READY_INTEGRATIONS = [
  { provider: 'whatsapp', label: 'WhatsApp' },
  { provider: 'google_calendar', label: 'Google Calendar' },
  { provider: 'microsoft_365', label: 'Microsoft 365' },
  { provider: 'hubspot', label: 'HubSpot' },
  { provider: 'zoho_crm', label: 'Zoho CRM' },
  { provider: 'odoo', label: 'Odoo' },
  { provider: 'rest_api', label: 'Webhooks / API' },
] as const

/**
 * The homepage's operational figures.
 *
 * These used to run six aggregate queries on every anonymous visit, on the
 * same connection pool a live call depends on, so a traffic spike competed
 * directly with real calls. They were cached here first; the cache has since
 * moved down into `server/data/marketing.ts`, where every consumer gets it —
 * `/sign-in` reads the same hero call, and the footer's contact row is on
 * every public page. Caching in one place rather than two means one window to
 * reason about and no chance of the layers disagreeing.
 */
async function loadLandingData() {
  const [proof, hero, demos, packs, integrations, consolePreview] = await Promise.all([
    getPlatformProof(),
    getHeroCall(),
    getDemoCalls(),
    getIndustryPacks(),
    getLiveIntegrations(),
    getConsolePreview(),
  ])
  return { proof, hero, demos, packs, integrations, consolePreview }
}

export async function Landing({ locale }: { locale: Locale }) {
  const copy = copyFor(locale)
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

  const data = await loadLandingData().catch((error: unknown) => {
    if (!isDatabaseUnavailable(error)) throw error
    console.error('[marketing] operational data unavailable')
    return null
  })
  const proof = data?.proof ?? null
  const hero = data?.hero ?? null
  const demos = data?.demos ?? []
  const packs = data?.packs ?? []
  const integrations = data?.integrations ?? []
  const consolePreview = data?.consolePreview ?? {
    queue: [],
    counts: { live: 0, review: 0, degraded: 0 },
  }
  const integrationProviders = new Map<string, { provider: string; label: string }>(
    READY_INTEGRATIONS.map((item) => [item.provider, { ...item }]),
  )
  for (const item of integrations) {
    if (!integrationProviders.has(item.provider)) {
      integrationProviders.set(item.provider, { provider: item.provider, label: item.label })
    }
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
        <div className="container">
          <div className="hero__grid">
            <div className="hero__copy">
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
                  data-cta="hero_contact"
                  variant="primary"
                  size="lg"
                  trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
                >
                  {copy.hero.primary}
                </LinkButton>
                <LinkButton href="#calls" size="lg" data-cta="hero_call_demos">
                  {copy.hero.secondary}
                </LinkButton>
              </div>

              {/* These used to repeat the assurance strip immediately below,
                  so they carry the objections that strip does not answer. */}
              <ul
                className="hero__assurance"
                aria-label={locale === 'ar' ? 'ما تحتاج معرفته قبل البدء' : 'Before you start'}
              >
                {copy.hero.assurances.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {hero ? (
              <div className="hero__product">
                <div className="hero__product-kicker">
                  <span>{locale === 'ar' ? 'داخل مُجاوِب' : 'Inside Mujawib'}</span>
                  <strong>
                    {locale === 'ar' ? 'المكالمة، الإجراء، والنتيجة' : 'Call, action, outcome'}
                  </strong>
                </div>
                <CallPlayer
                  locale={locale}
                  title={copy.hero.recordTitle}
                  meta={copy.hero.recordMeta}
                  turns={hero.turns}
                  tools={heroToolEvents}
                  totalSeconds={hero.durationSeconds ?? 60}
                  outcome={heroOutcome ?? undefined}
                />
              </div>
            ) : null}
          </div>

          {proof ? <ProofStrip copy={copy} proof={proof} /> : null}
        </div>
      </section>

      <DemoCalls
        locale={locale}
        copy={copy}
        calls={demos.map((d) => ({
          id: d.id,
          workspaceName: d.workspaceName,
          intent: intentLabel(d.intent, locale),
          outcome: outcomeLabel(d.outcome, locale),
          durationSeconds: d.durationSeconds,
          turns: d.turns,
        }))}
      />

      <Capabilities copy={copy} />

      <IntegrationWires copy={copy} providers={[...integrationProviders.values()]} />

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

      <ArabicFirst locale={locale} copy={copy} />

      <FailureHandling copy={copy} />

      <OutcomeStory locale={locale} copy={copy} />

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
