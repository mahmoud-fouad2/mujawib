import { ArrowLeft, ArrowRight, Check, Mail, MessageCircle, Phone } from 'lucide-react'
import Image from 'next/image'
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
  media,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  /** Optional framed visual. Without it these pages were walls of type. */
  media?: { src: string; alt: string; caption: string; sub: string }
  children?: React.ReactNode
}) {
  return (
    <section className="page-hero">
      <span className="aurora page-hero__aurora" aria-hidden="true" />
      <div className="container page-hero__grid">
        <span className="section__label">{eyebrow}</span>
        <div>
          <h1>{title}</h1>
          <p className="page-hero__lead">{lead}</p>
          {children}
        </div>
      </div>

      {media ? (
        <div className="container">
          <figure className="frame page-hero__media reveal">
            <Image
              src={media.src}
              alt={media.alt}
              fill
              sizes="(max-width: 1100px) 100vw, 1100px"
              priority
            />
            <span className="frame__shade" aria-hidden="true" />
            <figcaption className="frame__caption">
              <strong>{media.caption}</strong>
              <span>{media.sub}</span>
            </figcaption>
          </figure>
        </div>
      ) : null}
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
      <PageHero
        eyebrow={ar ? 'تواصل' : 'Contact'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/generated/console-signal-2027.webp',
          alt: '',
          caption: ar ? 'نبدأ بمكالمة، لا بنموذج' : 'We start with a call, not a form',
          sub: ar
            ? 'عشرون دقيقة نفهم فيها من يتصل بك وماذا يطلب — ثم نبني عليها.'
            : 'Twenty minutes to understand who calls you and what they ask for.',
        }}
      />

      <section className="section page-scope">
        <div className="container">
          <div className="channels reveal-group">
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
      <PageHero
        eyebrow={ar ? 'الأسعار' : 'Pricing'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/product/dashboard-ai-ops-2027.webp',
          alt: '',
          caption: ar
            ? 'كل ما تدفع مقابله ظاهر في لوحتك'
            : 'Everything you pay for is visible in your console',
          sub: ar
            ? 'عدد المكالمات المعالَجة، والنتيجة لكل واحدة — لا فاتورة مبهمة.'
            : 'Calls handled and the outcome of each — no opaque invoice.',
        }}
      />

      <section className="section">
        <div className="container">
          <div className="band lifts reveal-group">
            {p.bands.map((b) => (
              <article key={b.name} className={`band${b.featured ? ' band--featured' : ''}`}>
                {b.featured ? (
                  <Pill tone="signal">{ar ? 'الأكثر اختيارًا' : 'Most chosen'}</Pill>
                ) : null}
                <h2>{b.name}</h2>
                <p className="band lift__for">{b.forWho}</p>
                <p className="band lift__volume mono">{b.volume}</p>
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
      <PageHero
        eyebrow={ar ? 'من نحن' : 'About'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/generated/side-voice-operations-2027.webp',
          alt: '',
          caption: ar
            ? 'فريق تشغيل، لا أداة تتركك وحدك'
            : 'An operations team, not a tool that leaves you alone',
          sub: ar
            ? 'نجهّز ونختبر ونتابع الأسبوع الأول، ونبقى مسؤولين عن الجودة.'
            : 'We build, test, watch week one, and stay accountable for quality.',
        }}
      />

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
          <div className="cans reveal-group">
            {p.principles.map((pr) => (
              <article key={pr.title} className="can lift">
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
      <PageHero
        eyebrow={ar ? 'الموثوقية' : 'Reliability'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/generated/enterprise-voice-ops-2027.webp',
          alt: '',
          caption: ar ? 'كل تغيير على الإنتاج مسجّل' : 'Every production change is recorded',
          sub: ar
            ? 'من غيّر ماذا ومتى — قابل للمراجعة، وقابل للتراجع.'
            : 'Who changed what and when — reviewable, and reversible.',
        }}
      />

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
          <div className="shields reveal-group">
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
      <PageHero
        eyebrow={ar ? 'كيف نبدأ' : 'How we start'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/generated/industry-journey-2027.webp',
          alt: '',
          caption: ar
            ? 'من أول مكالمة معك إلى أول عميل يُخدَم'
            : 'From our first call to your first customer served',
          sub: ar
            ? 'أسبوع إلى ثلاثة أسابيع، وأنت تسمع النتيجة قبل التشغيل.'
            : 'One to three weeks, and you hear the result before launch.',
        }}
      >
        <p className="hero__proof-note" style={{ marginBlockStart: 'var(--s-4)' }}>
          {p.timeline}
        </p>
      </PageHero>

      <section className="section">
        <div className="container">
          <div className="stages reveal-group">
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
