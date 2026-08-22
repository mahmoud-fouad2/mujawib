import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Ear,
  FileText,
  Headphones,
  Languages,
  PhoneForwarded,
  Play,
  Quote,
  ShieldCheck,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { LinkButton } from '@/components/ui/button'
import { Counter } from '@/components/ui/motion'
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

/* ─── demo calls ─────────────────────────────────────────────────────────── */

export type DemoCall = {
  id: string
  workspaceName: string
  intent: string | null
  outcome: string | null
  durationSeconds: number | null
  turns: { role: 'agent' | 'caller'; text: string; at: number }[]
}

const DEMO_TURNS: Record<Locale, DemoCall['turns'][]> = {
  ar: [
    [
      { role: 'caller', text: 'أبحث عن شقة غرفتين قريبة من شمال الرياض.', at: 2 },
      { role: 'agent', text: 'ممتاز. هل ميزانيتك للشراء أم للإيجار؟', at: 7 },
      { role: 'caller', text: 'للإيجار، وفي حدود سبعين ألفًا سنويًا.', at: 13 },
      { role: 'agent', text: 'وجدت خيارين مناسبين. أرتّب لك معاينة غدًا؟', at: 19 },
    ],
    [
      { role: 'caller', text: 'كم سعر جلسة التنظيف؟', at: 2 },
      { role: 'agent', text: 'تبدأ من 250 ريالًا بعد تقييم الطبيب.', at: 8 },
      { role: 'caller', text: 'هل عندكم موعد مساء الخميس؟', at: 14 },
      { role: 'agent', text: 'متاح 6:30 مساءً. أثبّت الموعد باسمك؟', at: 20 },
    ],
    [
      { role: 'caller', text: 'أريد أعرف هل سيارتي جاهزة للاستلام.', at: 2 },
      { role: 'agent', text: 'أرسل لي آخر أربعة أرقام من أمر الصيانة.', at: 8 },
      { role: 'caller', text: 'أربعة، اثنان، سبعة، تسعة.', at: 14 },
      { role: 'agent', text: 'اكتمل الفحص والسيارة جاهزة من الخامسة.', at: 20 },
    ],
  ],
  en: [
    [
      { role: 'caller', text: 'I need a two-bedroom apartment in north Riyadh.', at: 2 },
      { role: 'agent', text: 'Is that to rent or buy, and what is your budget?', at: 7 },
      { role: 'caller', text: 'Rent, up to seventy thousand a year.', at: 13 },
      { role: 'agent', text: 'I found two matches. Shall I arrange a viewing tomorrow?', at: 19 },
    ],
    [
      { role: 'caller', text: 'How much is a cleaning session?', at: 2 },
      { role: 'agent', text: 'It starts at SAR 250 after the dentist checks your case.', at: 8 },
      { role: 'caller', text: 'Do you have a Thursday evening slot?', at: 14 },
      { role: 'agent', text: '6:30 PM is available. Shall I confirm it in your name?', at: 20 },
    ],
    [
      { role: 'caller', text: 'I want to know whether my car is ready.', at: 2 },
      { role: 'agent', text: 'Please share the last four digits of the service order.', at: 8 },
      { role: 'caller', text: 'Four, two, seven, nine.', at: 14 },
      {
        role: 'agent',
        text: 'Inspection is complete. It is ready for collection from five.',
        at: 20,
      },
    ],
  ],
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
          {calls.map((c, index) => {
            const turns = c.turns.length > 0 ? c.turns : (DEMO_TURNS[locale][index] ?? [])

            return (
              <details key={c.id} className="demo lift">
                <summary className="demo__head">
                  <span className="demo__play" aria-hidden="true">
                    <Play size={15} />
                  </span>
                  <span className="demo__wave" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
                    ))}
                  </span>
                  <strong>{c.intent}</strong>
                  <span className="demo__result">
                    <Check size={13} aria-hidden="true" />
                    {c.outcome}
                  </span>
                  <span className="demo__time">{duration(c.durationSeconds)}</span>
                  <ChevronDown className="demo__chevron" size={16} aria-hidden="true" />
                </summary>

                <div className="demo__turns">
                  {turns.slice(0, 4).map((t) => (
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
              </details>
            )
          })}
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

        <div className="assurance-rail reveal">
          <span className="assurance-rail__lead">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              <strong>{copy.security.title}</strong>
              <small>{copy.security.lead}</small>
            </span>
          </span>
          <ul>
            {copy.security.items.slice(0, 4).map((item) => (
              <li key={item.title}>
                <Check size={14} aria-hidden="true" />
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ─── operational outcome ─────────────────────────────────────────────── */

export function OutcomeStory({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section section--tinted" id="outcomes">
      <div className="container">
        <SectionHead
          label={copy.results.label}
          title={copy.results.title}
          lead={copy.results.lead}
        />

        <div className="outcome-shift reveal">
          <div className="outcome-shift__side is-before">
            <span className="outcome-shift__title">{copy.results.beforeTitle}</span>
            <ul>
              {copy.results.before.map((item) => (
                <li key={item}>
                  <X size={15} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <span className="outcome-shift__arrow" aria-hidden="true">
            <ArrowLeftRight size={18} />
          </span>

          <div className="outcome-shift__side is-after">
            <span className="outcome-shift__title">{copy.results.afterTitle}</span>
            <ul>
              {copy.results.after.map((item) => (
                <li key={item}>
                  <Check size={15} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <figure className="testimonial reveal">
          <Quote size={26} aria-hidden="true" />
          <blockquote>“{copy.results.quote}”</blockquote>
          <figcaption>{copy.results.quoteBy}</figcaption>
        </figure>
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

  return (
    <section className="section" id="integrations">
      <div className="container">
        <SectionHead
          label={copy.integrations.label}
          title={copy.integrations.title}
          lead={copy.integrations.lead}
        />
      </div>

      <ul
        className="integration-rail"
        aria-label={locale === 'ar' ? 'التكاملات المتاحة' : 'Available integrations'}
      >
        {list.map((p) => (
          <li key={p.provider} className="wirechip">
            <span className="wirechip__logo">
              <Image
                src={PROVIDER_LOGO[p.provider] ?? '/images/integrations/webhooks.svg'}
                alt=""
                width={22}
                height={22}
              />
            </span>
            <span className="wirechip__text">
              <strong>{p.label}</strong>
              <span>{PROVIDER_ACTION_LABEL[p.provider]?.[locale]}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="container">
        <div className="flow-end">
          <Check size={16} aria-hidden="true" />
          <strong>{copy.integrations.flowEnd}</strong>
          <span>{copy.integrations.note}</span>
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
              {i.n > 0 ? (
                <Counter value={i.n} suffix={i.suffix} />
              ) : (
                <span>
                  <span aria-hidden="true">—</span>
                  <span className="visually-hidden">0</span>
                </span>
              )}
            </strong>
            <span>{i.label}</span>
          </div>
        ))}
      </div>
      <p className="hero__proof-note">{copy.proofNote}</p>
    </div>
  )
}
