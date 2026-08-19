import { ArrowLeft, ArrowRight, Check, Mail, MessageCircle, Phone } from 'lucide-react'
import { SectionHead } from '@/components/site/sections'
import { LinkButton } from '@/components/ui/button'
import { Pill } from '@/components/ui/primitives'
import { pagesFor } from '@/lib/content/pages'
import { copyFor } from '@/lib/content/site'
import { isRtl, type Locale, localePath } from '@/lib/i18n'

/**
 * Standalone pages. Each has its own layout: a contact page is a set of
 * channels, a pricing page is bands, an FAQ is a disclosure list. Rendering
 * them through one shared template is what made the old side pages feel
 * interchangeable.
 */

function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  children?: React.ReactNode
}) {
  return (
    <section className="page-hero">
      <div className="container page-hero__grid">
        <span className="section__label">{eyebrow}</span>
        <div>
          <h1>{title}</h1>
          <p className="page-hero__lead">{lead}</p>
          {children}
        </div>
      </div>
    </section>
  )
}

/* ─── contact ────────────────────────────────────────────────────────────── */

const CHANNEL_ICON = [Mail, Phone, MessageCircle]

export function ContactPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).contact
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'تواصل' : 'Contact'} title={p.title} lead={p.lead} />

      <section className="section">
        <div className="container">
          <div className="channels">
            {p.channels.map((c, i) => {
              const Icon = CHANNEL_ICON[i % CHANNEL_ICON.length] ?? Mail
              return (
                <a key={c.label} href={c.href} className="channel">
                  <span className="channel__icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="channel__label">{c.label}</span>
                  <strong className="channel__value mono">{c.value}</strong>
                  <span className="channel__note">{c.note}</span>
                </a>
              )
            })}
          </div>

          <div className="expect">
            <h2>{ar ? 'ماذا يحدث بعد أن تتواصل' : 'What happens after you get in touch'}</h2>
            <ol>
              {p.expect.map((e, i) => (
                <li key={e.step}>
                  <span className="expect__n mono">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{e.step}</strong>
                    <p>{e.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="expect__hours">{p.hours}</p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ─── pricing ────────────────────────────────────────────────────────────── */

export function PricingPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).pricing
  const site = copyFor(locale)
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'الأسعار' : 'Pricing'} title={p.title} lead={p.lead} />

      <section className="section">
        <div className="container">
          <div className="bands">
            {p.bands.map((b) => (
              <article key={b.name} className={`band${b.featured ? ' band--featured' : ''}`}>
                {b.featured ? (
                  <Pill tone="signal">{ar ? 'الأكثر اختيارًا' : 'Most chosen'}</Pill>
                ) : null}
                <h2>{b.name}</h2>
                <p className="band__for">{b.forWho}</p>
                <p className="band__volume mono">{b.volume}</p>
                <ul>
                  {b.includes.map((i) => (
                    <li key={i}>
                      <Check size={15} aria-hidden="true" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
                <LinkButton
                  href={localePath(locale, '/contact')}
                  variant={b.featured ? 'primary' : 'default'}
                  block
                  trailing={<Arrow size={16} className="arrow" aria-hidden="true" />}
                >
                  {site.pricing.primary}
                </LinkButton>
              </article>
            ))}
          </div>

          <p className="section__note">{p.note}</p>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'أسئلة عن السعر' : 'Pricing questions'}
            title={ar ? 'قبل أن تسأل.' : 'Before you ask.'}
          />
          <div className="faq">
            {p.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ─── faq ────────────────────────────────────────────────────────────────── */

export function FaqPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).faq
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'الأسئلة الشائعة' : 'FAQ'} title={p.title} lead={p.lead} />

      {p.groups.map((g, i) => (
        <section key={g.title} className={`section${i % 2 === 1 ? ' section--tinted' : ''}`}>
          <div className="container">
            <SectionHead label={`${String(i + 1).padStart(2, '0')}`} title={g.title} />
            <div className="faq">
              {g.items.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

/* ─── about ──────────────────────────────────────────────────────────────── */

export function AboutPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).about
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'من نحن' : 'About'} title={p.title} lead={p.lead} />

      <section className="section">
        <div className="container">
          <div className="prose">
            {p.story.map((s) => (
              <p key={s.slice(0, 24)}>{s}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'مبادئ' : 'Principles'}
            title={ar ? 'أربعة أشياء لا نتنازل عنها.' : 'Four things we do not bend on.'}
          />
          <div className="cans">
            {p.principles.map((pr) => (
              <article key={pr.title} className="can">
                <h3>{pr.title}</h3>
                <p>{pr.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="stance">
            <h2>{p.stance.title}</h2>
            <p>{p.stance.body}</p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ─── security ───────────────────────────────────────────────────────────── */

export function SecurityPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).security
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'الموثوقية' : 'Reliability'} title={p.title} lead={p.lead} />

      <section className="section">
        <div className="container">
          <div className="prose">
            {p.intro.map((s) => (
              <p key={s.slice(0, 24)}>{s}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'ما نفعله' : 'What we do'}
            title={ar ? 'ست ممارسات مطبَّقة اليوم.' : 'Six practices in place today.'}
          />
          <div className="shields">
            {p.practices.map((s) => (
              <article key={s.title} className="shield">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {/* Stating the limits plainly is the point of the page. */}
          <div className="stance stance--plain">
            <h2>{ar ? 'ما لا ندّعيه' : 'What we do not claim'}</h2>
            <p>{p.notClaimed}</p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ─── how it works ───────────────────────────────────────────────────────── */

export function HowItWorksPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).howItWorks
  const site = copyFor(locale)
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const ar = locale === 'ar'

  return (
    <>
      <PageHero eyebrow={ar ? 'كيف نبدأ' : 'How we start'} title={p.title} lead={p.lead}>
        <p className="hero__proof-note" style={{ marginBlockStart: 'var(--s-4)' }}>
          {p.timeline}
        </p>
      </PageHero>

      <section className="section">
        <div className="container">
          <div className="stages">
            {p.detail.map((d) => (
              <article key={d.n} className="stage">
                <span className="stage__n mono">{d.n}</span>
                <div className="stage__body">
                  <h2>{d.title}</h2>
                  <p>{d.body}</p>
                </div>
                <dl className="stage__split">
                  <div>
                    <dt>{ar ? 'دورك' : 'You'}</dt>
                    <dd>{d.youDo}</dd>
                  </div>
                  <div>
                    <dt>{ar ? 'دورنا' : 'Us'}</dt>
                    <dd>{d.weDo}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <div className="close-cta">
            <div>
              <h2>{site.cta.title}</h2>
              <p>{site.cta.body}</p>
            </div>
            <div className="close-cta__actions">
              <LinkButton
                href={localePath(locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {site.cta.primary}
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
