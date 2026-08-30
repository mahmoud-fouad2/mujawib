import {
  AlertTriangle,
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
  ShieldCheck,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { LinkButton } from '@/components/ui/button'
import { Counter } from '@/components/ui/motion'
import type { SiteCopy } from '@/lib/content/site'
import { intentLabel } from '@/lib/content/vocabulary'
import { duration, num } from '@/lib/format'
import { isRtl, type Locale, localePath } from '@/lib/i18n'
import { withArabicRuns } from '@/lib/lang-runs'

/** Points the way the page reads. */
/** Used only inside this file — not exported, since nothing outside imports it. */
function ArrowIcon({
  locale,
  ...rest
}: { locale: Locale } & React.ComponentProps<typeof ArrowRight>) {
  const Icon = isRtl(locale) ? ArrowLeft : ArrowRight
  return <Icon {...rest} />
}

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
      { role: 'caller', text: 'أهلاً، أبحث عن شقة غرفتين وصالة قريبة من شمال الرياض.', at: 2 },
      {
        role: 'agent',
        text: 'أهلاً بك! هل تفضلها للإيجار أم للشراء؟ وما هي ميزانيتك السنوية؟',
        at: 7,
      },
      { role: 'caller', text: 'للإيجار السنوي، في حدود سبعين إلى ثمانين ألف ريال.', at: 13 },
      {
        role: 'agent',
        text: 'ممتاز، متاح لدينا خياران في حي الياسمين والنرجس. تحب أرتب لك موعد معاينة غداً؟',
        at: 19,
      },
    ],
    [
      { role: 'caller', text: 'السلام عليكم، كم سعر جلسة تنظيف وتبييض الأسنان عندكم؟', at: 2 },
      {
        role: 'agent',
        text: 'وعليكم السلام ورحمة الله. التنظيف يبدأ من 250 ريال، والتبييض مع الفحص بـ 650 ريال.',
        at: 8,
      },
      { role: 'caller', text: 'ممتاز، هل عندكم موعد متاح مساء يوم الخميس؟', at: 14 },
      {
        role: 'agent',
        text: 'متاح 6:30 مساءً مع الدكتور خالد. سأثبت الموعد وأرسل لك التأكيد عبر واتساب فوراً.',
        at: 20,
      },
    ],
    [
      { role: 'caller', text: 'مرحبا، حاب استفسر هل سيارتي جاهزة للاستلام من الصيانة؟', at: 2 },
      {
        role: 'agent',
        text: 'أهلاً بك. فضلاً زودني بآخر أربعة أرقام من أمر الصيانة أو رقم الجوال.',
        at: 8,
      },
      { role: 'caller', text: 'أربعة، اثنان، سبعة، تسعة.', at: 14 },
      {
        role: 'agent',
        text: 'أهلاً أستاذ فيصل، اكتمل الفحص وتغيير الزيت والسيارة جاهزة للاستلام من فرع السليمانية.',
        at: 20,
      },
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
                  {/* These are seeded scenarios, not client calls. Naming the
                      workspace without saying so read as a customer list. */}
                  <span className="demo__client">
                    {locale === 'ar' ? 'سيناريو تجريبي' : 'Demo scenario'}
                  </span>
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

export function OutcomeStory({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
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

        {/* This slot held a quote with no attributable source. For a product
            this early, saying why there are no logos yet buys more trust than
            a testimonial a reader cannot check. */}
        <div className="honesty reveal">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <strong>{copy.results.honesty.title}</strong>
            <p>{copy.results.honesty.body}</p>
          </div>
          <LinkButton
            href={localePath(locale, '/contact')}
            data-cta="results_contact"
            variant="primary"
            trailing={<ArrowIcon locale={locale} size={16} className="arrow" aria-hidden="true" />}
          >
            {copy.results.honesty.cta}
          </LinkButton>
        </div>
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
  copy,
  providers,
}: {
  copy: SiteCopy
  providers: { provider: string; label: string }[]
}) {
  const list = providers.filter((p) => PROVIDER_ACTION_LABEL[p.provider])
  if (list.length === 0) return null

  // Duplicate items for a seamless continuous loop with unique keys
  const marqueeItems = [
    ...list.map((item) => ({ ...item, id: `${item.provider}-t1` })),
    ...list.map((item) => ({ ...item, id: `${item.provider}-t2` })),
    ...list.map((item) => ({ ...item, id: `${item.provider}-t3` })),
    ...list.map((item) => ({ ...item, id: `${item.provider}-t4` })),
  ]

  return (
    <section className="section" id="integrations">
      <div className="container">
        <SectionHead
          label={copy.integrations.label}
          title={copy.integrations.title}
          lead={copy.integrations.lead}
        />

        <div className="integration-image reveal">
          <Image
            src="/images/site/integrations-light.png"
            alt="Integrations Architecture"
            width={1200}
            height={600}
            className="integration-image__light"
          />
          <Image
            src="/images/site/integrations-dark.png"
            alt="Integrations Architecture"
            width={1200}
            height={600}
            className="integration-image__dark"
          />
        </div>
      </div>

      <div className="integration-marquee">
        <div className="integration-track">
          {marqueeItems.map((p) => (
            <div key={p.id} className="wirechip wirechip--logo-only" title={p.label}>
              <span className="wirechip__logo">
                <Image
                  src={PROVIDER_LOGO[p.provider] ?? '/images/integrations/webhooks.svg'}
                  alt={p.label}
                  width={48}
                  height={48}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

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
  // With no live traffic the three counters read 0 · 0 · 0, which says the
  // product is unused rather than that the console is calm. Show the panel's
  // shape without the zeros until there is something to count.
  const hasCounts = counts.live + counts.review + counts.degraded > 0

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
                data-cta="console_sign_in"
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
              {hasCounts ? (
                <>
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
                </>
              ) : (
                <span className="cpanel__stat">
                  {ar
                    ? 'المكالمات الجارية، وما يحتاج مراجعة، وحالة كل ربط'
                    : 'Calls in progress, what needs review, and the state of every connection'}
                </span>
              )}
            </div>

            <div className="cpanel__rows">
              {queue.map((q) => (
                <div key={q.id} className="cpanel__row">
                  <div className="cpanel__main">
                    <strong>{intentLabel(q.intent, locale) ?? (ar ? 'مكالمة' : 'Call')}</strong>
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
              data-cta="closing_contact_primary"
              variant="primary"
              size="lg"
              trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
            >
              {copy.cta.primary}
            </LinkButton>
            <LinkButton
              href={localePath(locale, '/contact')}
              size="lg"
              data-cta="closing_contact_secondary"
            >
              {copy.cta.secondary}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── hero proof strip ───────────────────────────────────────────────────── */

/**
 * Below this, the last 30 days say nothing a buyer should weigh: a handful of
 * calls reads as "nobody uses this", and a rate computed over them is noise.
 */
const MEANINGFUL_CALL_VOLUME = 250

export function ProofStrip({
  copy,
  proof,
}: {
  copy: SiteCopy
  proof: { callsHandled: number; bookings: number; resolvedRate: number }
}) {
  // Median latency is deliberately not published. It is an operations metric,
  // and a figure in seconds — which is what a mixed sample produces — reads as
  // a slow agent no matter how the label frames it.
  const live = proof.callsHandled >= MEANINGFUL_CALL_VOLUME && proof.bookings > 0

  if (!live) {
    return (
      <div className="hero__proof">
        <div className="hero__proof-grid hero__proof-grid--assurance">
          {copy.assurances.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
          ))}
        </div>
        <p className="hero__proof-note">{copy.assuranceNote}</p>
      </div>
    )
  }

  const items = [
    { n: proof.callsHandled, suffix: '', label: copy.proofLabels.calls },
    { n: proof.bookings, suffix: '', label: copy.proofLabels.bookings },
    { n: proof.resolvedRate, suffix: '%', label: copy.proofLabels.resolved },
  ]

  return (
    <div className="hero__proof">
      <div className="hero__proof-grid">
        {items.map((i) => (
          <div key={i.label}>
            <strong>
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

/* ─── arabic-first proof ─────────────────────────────────────────────────── */

/**
 * This copy has sat in the content file unrendered. It carries the only claims
 * on the site a competitor cannot copy verbatim — dialect handling, how a
 * ten-digit number said twice is heard, rollback — so it belongs on the page.
 */
export function ArabicFirst({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  return (
    <section className="section" id="arabic">
      <div className="container">
        <SectionHead label={copy.why.label} title={copy.why.title} lead={copy.why.lead} />
        <div className="whys reveal-group">
          {copy.why.rows.map((row) => (
            <article key={row.key} className="why">
              <span className="why__key">{row.key}</span>
              <h3>{row.title}</h3>
              {/* The dialect row quotes Arabic inside an English sentence. */}
              <p>{locale === 'en' ? withArabicRuns(row.body) : row.body}</p>
              <dl className="why__proof">
                {row.proof.map((item) => (
                  <div key={item.term}>
                    <dt>
                      <Check size={14} aria-hidden="true" />
                      {item.term}
                    </dt>
                    <dd>{item.detail}</dd>
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

/* ─── failure handling ───────────────────────────────────────────────────── */

/**
 * The section a buyer actually needs and almost no voice product publishes:
 * what happens on the call that does not go to plan.
 */
export function FailureHandling({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section" id="failure">
      <div className="container">
        <SectionHead
          label={copy.failure.label}
          title={copy.failure.title}
          lead={copy.failure.lead}
        />
        <ul className="failures reveal-group">
          {copy.failure.rows.map((row) => (
            <li key={row.situation} className="failure">
              <span className="failure__when">
                <AlertTriangle size={15} aria-hidden="true" />
                {row.situation}
              </span>
              <p className="failure__then">{row.handling}</p>
            </li>
          ))}
        </ul>
        <p className="section__note">{copy.failure.note}</p>
      </div>
    </section>
  )
}
