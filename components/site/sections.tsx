import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Ear,
  FileText,
  Headphones,
  Languages,
  Minus,
  PhoneForwarded,
} from 'lucide-react'
import Image from 'next/image'
import { LinkButton } from '@/components/ui/button'
import { Counter, Marquee } from '@/components/ui/motion'
import type { SiteCopy } from '@/lib/content/site'
import { duration, num } from '@/lib/format'
import { isRtl, type Locale, localePath } from '@/lib/i18n'

export function SectionHead({
  label,
  title,
  lead,
}: {
  label: string
  title: string
  lead?: string
}) {
  return (
    <header className="section__head">
      <span className="section__label">{label}</span>
      <div>
        <h2 className="section__title">{title}</h2>
        {lead ? <p className="section__lead">{lead}</p> : null}
      </div>
    </header>
  )
}

/* ─── trust ──────────────────────────────────────────────────────────────── */

export function TrustRow({
  label,
  caption,
  names,
}: {
  label: string
  caption: string
  names: string[]
}) {
  if (names.length === 0) return null
  // Repeat until the track is long enough for the loop to look continuous.
  const band = [...names, ...names, ...names]

  return (
    <section className="trust">
      <div className="container trust__head-row">
        <span className="trust__label">{label}</span>
        <p>{caption}</p>
      </div>
      <Marquee duration={46} reverse>
        {band.map((n, i) => (
          // The band repeats the same names to fill the loop, so position is
          // the only thing that distinguishes one copy from the next.
          // biome-ignore lint/suspicious/noArrayIndexKey: repeated marquee set
          <span key={`${n}-${i}`} className="trust-name">
            {n}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ─── demo calls ─────────────────────────────────────────────────────────── */

export type DemoCall = {
  id: string
  workspaceName: string
  intent: string | null
  outcome: string | null
  durationSeconds: number | null
  turns: { role: 'agent' | 'caller'; text: string; at: number }[]
}

export function DemoCalls({
  locale,
  copy,
  calls,
}: {
  locale: Locale
  copy: SiteCopy
  calls: DemoCall[]
}) {
  if (calls.length === 0) return null
  const labels =
    locale === 'ar' ? { agent: 'مُجاوِب', caller: 'العميل' } : { agent: 'Mujawib', caller: 'Caller' }

  return (
    <section className="section" id="calls">
      <div className="container">
        <SectionHead label={copy.demo.label} title={copy.demo.title} lead={copy.demo.lead} />
        <div className="demos reveal-group">
          {calls.map((c) => (
            <article key={c.id} className="demo lift">
              <div className="demo__head">
                <span className="demo__wave" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
                  ))}
                </span>
                <strong>{c.intent}</strong>
                <span className="demo__time">{duration(c.durationSeconds)}</span>
              </div>

              <div className="demo__turns">
                {c.turns.slice(0, 4).map((t) => (
                  <div
                    key={`${c.id}-${t.at}-${t.role}`}
                    className={`demo__turn${t.role === 'agent' ? ' is-agent' : ''}`}
                  >
                    <span>{t.role === 'agent' ? labels.agent : labels.caller}</span>
                    <p>{t.text}</p>
                  </div>
                ))}
              </div>

              <div className="demo__foot">
                <Check size={14} aria-hidden="true" />
                <strong>{c.outcome}</strong>
                <span className="demo__client">{c.workspaceName}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── capabilities ───────────────────────────────────────────────────────── */

const CAN_ICONS = [Languages, Ear, CalendarCheck, FileText, PhoneForwarded, Headphones]

export function Capabilities({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section section--tinted" id="can">
      <div className="container">
        <SectionHead label={copy.can.label} title={copy.can.title} lead={copy.can.lead} />
        {/* A list, not cards. Six bordered boxes of body text was the "card
            soup" that made this page read as filler. */}
        <ul className="caps reveal-group">
          {copy.can.items.map((item, i) => {
            const Icon = CAN_ICONS[i % CAN_ICONS.length] ?? Languages
            return (
              <li key={item.title} className="cap">
                <span className="cap__icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ─── why ────────────────────────────────────────────────────────────────── */

export function WhyRows({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section" id="quality">
      <div className="container">
        <SectionHead label={copy.why.label} title={copy.why.title} lead={copy.why.lead} />
        <div className="rows reveal-group">
          {copy.why.rows.map((row) => (
            <article key={row.key} className="rows__item">
              <span className="rows__key">{row.key}</span>
              <div>
                <h3>{row.title}</h3>
                <p style={{ marginBlockStart: 'var(--s-3)' }}>{row.body}</p>
              </div>
              <dl className="rows__proof">
                {row.proof.map((p) => (
                  <div key={p.term}>
                    <dt>
                      <Check size={13} aria-hidden="true" />
                      {p.term}
                    </dt>
                    <dd>{p.detail}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── results / before-after ─────────────────────────────────────────────── */

export function Results({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section" id="results">
      <div className="container">
        <SectionHead
          label={copy.results.label}
          title={copy.results.title}
          lead={copy.results.lead}
        />

        <div className="ba reveal-group">
          <div className="ba__col ba__col--before">
            <h3>{copy.results.beforeTitle}</h3>
            <ul>
              {copy.results.before.map((b) => (
                <li key={b}>
                  <Minus size={14} aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ba__col ba__col--after">
            <h3>{copy.results.afterTitle}</h3>
            <ul>
              {copy.results.after.map((a) => (
                <li key={a}>
                  <Check size={14} aria-hidden="true" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="ba__quote">
            <Image
              src="/images/generated/enterprise-voice-ops-2027.webp"
              alt=""
              fill
              sizes="(max-width: 980px) 100vw, 32vw"
              className="ba__quote-img"
            />
            <span className="ba__quote-shade" aria-hidden="true" />
            <blockquote>«{copy.results.quote}»</blockquote>
            <figcaption>{copy.results.quoteBy}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}

/* ─── deployment ─────────────────────────────────────────────────────────── */

export function Deployment({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section section--tinted" id="deployment">
      <div className="container">
        <SectionHead
          label={copy.deployment.label}
          title={copy.deployment.title}
          lead={copy.deployment.lead}
        />
        {/* A genuine ordered sequence — the numbering carries real information. */}
        <ol className="steps reveal-group">
          {copy.deployment.steps.map((s) => (
            <li key={s.n} className="step">
              <span className="step__n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="step__out">
                <Check size={13} aria-hidden="true" />
                {s.output}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ─── integrations ───────────────────────────────────────────────────────── */

const PROVIDER_LOGO: Record<string, string> = {
  google_calendar: '/images/integrations/google-calendar.svg',
  microsoft_365: '/images/integrations/microsoft-calendar.svg',
  whatsapp: '/images/integrations/whatsapp.svg',
  hubspot: '/images/integrations/hubspot.svg',
  zoho_crm: '/images/integrations/zoho.svg',
  odoo: '/images/integrations/odoo.svg',
  rest_api: '/images/integrations/webhooks.svg',
}

const PROVIDER_ACTION_LABEL: Record<string, Record<Locale, string>> = {
  google_calendar: { ar: 'يفتح التقويم ويثبّت الموعد', en: 'Opens the calendar and locks the slot' },
  microsoft_365: { ar: 'يقرأ المتاح ويحجز', en: 'Reads availability and books' },
  whatsapp: { ar: 'يرسل التأكيد والموقع', en: 'Sends confirmation and location' },
  hubspot: { ar: 'يسجّل العميل المحتمل', en: 'Logs the lead' },
  zoho_crm: { ar: 'يبحث عن العميل ويضيف ملاحظة', en: 'Finds the customer and adds a note' },
  odoo: { ar: 'ينشئ الطلب في نظامك', en: 'Creates the order in your system' },
  rest_api: { ar: 'يستدعي نظامك الخاص', en: 'Calls your own system' },
}

export function IntegrationWires({
  locale,
  copy,
  providers,
}: {
  locale: Locale
  copy: SiteCopy
  providers: { provider: string; label: string }[]
}) {
  const list = providers.filter((p) => PROVIDER_ACTION_LABEL[p.provider])
  if (list.length === 0) return null

  // The band reads as continuous motion, so it needs more than four items to
  // loop convincingly; repeat the connected set until it fills the track.
  const band = [...list, ...list, ...list].slice(0, 12)

  return (
    <section className="section" id="integrations">
      <div className="container">
        <SectionHead
          label={copy.integrations.label}
          title={copy.integrations.title}
          lead={copy.integrations.lead}
        />
      </div>

      <Marquee duration={42}>
        {band.map((p, i) => (
          // Same repeated-set reasoning as the trust band above.
          // biome-ignore lint/suspicious/noArrayIndexKey: repeated marquee set
          <span key={`${p.provider}-${i}`} className="chip">
            <Image
              src={PROVIDER_LOGO[p.provider] ?? '/images/integrations/webhooks.svg'}
              alt=""
              width={20}
              height={20}
            />
            {p.label}
          </span>
        ))}
      </Marquee>

      <div className="container">
        <div className="wires reveal-group">
          {list.map((p) => (
            <article key={p.provider} className="wire lift">
              <span className="wire__logo">
                <Image
                  src={PROVIDER_LOGO[p.provider] ?? '/images/integrations/webhooks.svg'}
                  alt=""
                  width={22}
                  height={22}
                />
              </span>
              <strong>{p.label}</strong>
              <span className="wire__action">{PROVIDER_ACTION_LABEL[p.provider]?.[locale]}</span>
            </article>
          ))}
        </div>

        <div className="flow-end">
          <Check size={16} aria-hidden="true" />
          <strong>{copy.integrations.flowEnd}</strong>
          <span>{copy.integrations.note}</span>
        </div>
      </div>
    </section>
  )
}

/* ─── security ───────────────────────────────────────────────────────────── */

export function Security({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section section--tinted" id="security">
      <div className="container">
        <SectionHead
          label={copy.security.label}
          title={copy.security.title}
          lead={copy.security.lead}
        />
        <div className="shields reveal-group">
          {copy.security.items.map((i) => (
            <article key={i.title} className="shield">
              <h3>{i.title}</h3>
              <p>{i.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── pricing ────────────────────────────────────────────────────────────── */

export function Pricing({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

  return (
    <section className="section" id="pricing">
      <div className="container">
        <SectionHead
          label={copy.pricing.label}
          title={copy.pricing.title}
          lead={copy.pricing.lead}
        />
        <div className="pricing reveal">
          <ul className="pricing__points">
            {copy.pricing.points.map((p) => (
              <li key={p}>
                <Check size={16} aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="pricing__actions">
            <LinkButton
              href={localePath(locale, '/contact')}
              variant="primary"
              size="lg"
              trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
            >
              {copy.pricing.primary}
            </LinkButton>
            <LinkButton href={localePath(locale, '/contact')} size="lg">
              {copy.pricing.secondary}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── console preview ────────────────────────────────────────────────────── */

export type ConsoleQueueRow = {
  id: string
  workspaceName: string
  intent: string | null
  outcome: string | null
  durationSeconds: number | null
  flags: string[]
}

export function ConsolePreview({
  locale,
  copy,
  queue,
  counts,
}: {
  locale: Locale
  copy: SiteCopy
  queue: ConsoleQueueRow[]
  counts: { live: number; review: number; degraded: number }
}) {
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const ar = locale === 'ar'

  return (
    <section className="section on-ink" id="console">
      <div className="container">
        <SectionHead
          label={copy.console.label}
          title={copy.console.title}
          lead={copy.console.lead}
        />
        <div className="console-preview reveal">
          <ul className="console-preview__points">
            {copy.console.points.map((p) => (
              <li key={p}>
                <Check size={15} aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
            <li className="console-preview__cta">
              <LinkButton
                href="/sign-in"
                variant="primary"
                trailing={<Arrow size={16} className="arrow" aria-hidden="true" />}
              >
                {copy.console.cta}
              </LinkButton>
            </li>
          </ul>

          {/* The console's own ranking surface — the hero already showed one
              call end to end, so repeating it here would say nothing new. */}
          <div className="cpanel">
            <div className="cpanel__bar">
              <span className="cpanel__stat" data-tone="live">
                <b>{num(counts.live)}</b>
                {ar ? 'مباشر الآن' : 'live now'}
              </span>
              <span className="cpanel__stat" data-tone="warn">
                <b>{num(counts.review)}</b>
                {ar ? 'تحتاج مراجعة' : 'need review'}
              </span>
              <span className="cpanel__stat" data-tone={counts.degraded ? 'bad' : undefined}>
                <b>{num(counts.degraded)}</b>
                {ar ? 'ربط متعثر' : 'degraded'}
              </span>
            </div>

            <div className="cpanel__rows">
              {queue.map((q) => (
                <div key={q.id} className="cpanel__row">
                  <div className="cpanel__main">
                    <strong>{q.intent ?? (ar ? 'مكالمة' : 'Call')}</strong>
                    <span>{q.workspaceName}</span>
                  </div>
                  <div className="cpanel__flags">
                    {q.flags.slice(0, 1).map((f) => (
                      <em key={f}>{f}</em>
                    ))}
                  </div>
                  <span className="cpanel__dur mono">{duration(q.durationSeconds)}</span>
                </div>
              ))}
            </div>

            <div className="cpanel__foot">
              {ar ? 'مرتّبة حسب ما يحتاج قرارك أولًا' : 'Ranked by what needs your decision first'}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── closing CTA ────────────────────────────────────────────────────────── */

export function CloseCta({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

  return (
    <section className="section">
      <div className="container">
        <div className="close-cta reveal">
          <div>
            <h2>{copy.cta.title}</h2>
            <p>{copy.cta.body}</p>
            <p className="close-cta__note">
              <Check size={14} aria-hidden="true" />
              {copy.cta.note}
            </p>
          </div>
          <div className="close-cta__actions">
            <LinkButton
              href={localePath(locale, '/contact')}
              variant="primary"
              size="lg"
              trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
            >
              {copy.cta.primary}
            </LinkButton>
            <LinkButton href={localePath(locale, '/contact')} size="lg">
              {copy.cta.secondary}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── hero proof strip ───────────────────────────────────────────────────── */

export function ProofStrip({
  copy,
  proof,
}: {
  copy: SiteCopy
  proof: { callsHandled: number; bookings: number; resolvedRate: number; medianResponseMs: number }
}) {
  const items = [
    { n: proof.callsHandled, suffix: '+', label: copy.proofLabels.calls },
    { n: proof.bookings, suffix: '', label: copy.proofLabels.bookings },
    { n: proof.resolvedRate, suffix: '%', label: copy.proofLabels.resolved },
    { n: proof.medianResponseMs, suffix: 'ms', label: copy.proofLabels.response },
  ]

  return (
    <div className="hero__proof">
      <div className="hero__proof-grid">
        {items.map((i) => (
          <div key={i.label}>
            <strong>
              {/* Counts up once on entry — these are real platform figures, so
                  drawing the eye to them is the point of the strip. */}
              <Counter value={i.n} suffix={i.suffix} />
            </strong>
            <span>{i.label}</span>
          </div>
        ))}
      </div>
      <p className="hero__proof-note">{copy.proofNote}</p>
    </div>
  )
}
