import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Database,
  History,
  KeyRound,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  PhoneForwarded,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
} from 'lucide-react'
import Image from 'next/image'
import { ContactForm } from '@/components/site/contact-form'
import { FaqInteractive } from '@/components/site/faq-interactive'
import { SectionHead } from '@/components/site/sections'
import { LinkButton } from '@/components/ui/button'
import { Pill } from '@/components/ui/primitives'
import { pagesFor } from '@/lib/content/pages'
import { copyFor } from '@/lib/content/site'
import { isRtl, type Locale, localePath } from '@/lib/i18n'
import type { PlatformContact } from '@/server/data/platform'

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

const CHANNEL_ICON = { email: Mail, phone: Phone, whatsapp: MessageCircle } as const

/**
 * Email/phone/WhatsApp are only ever shown once an operator has confirmed
 * the channel actually answers (`getPlatformContact` — Bible: "a published
 * channel that does not answer costs more than no channel at all"). A
 * channel with no confirmed value resolves to `null` and is dropped rather
 * than rendered with a placeholder.
 */
function resolveChannel(
  type: 'email' | 'phone' | 'whatsapp',
  contact: PlatformContact,
): { value: string; href: string } | null {
  if (type === 'email') {
    return contact.email ? { value: contact.email, href: `mailto:${contact.email}` } : null
  }
  if (type === 'phone') {
    return contact.phone
      ? { value: contact.phone.display, href: `tel:${contact.phone.e164}` }
      : null
  }
  return contact.whatsappUrl && contact.phone
    ? { value: contact.phone.display, href: contact.whatsappUrl }
    : null
}

export function ContactPage({ locale, contact }: { locale: Locale; contact: PlatformContact }) {
  const p = pagesFor(locale).contact
  const ar = locale === 'ar'
  const channels = p.channels
    .map((c) => {
      const resolved = resolveChannel(c.type, contact)
      return resolved ? { ...c, ...resolved } : null
    })
    .filter((c) => c !== null)

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
          <ContactForm locale={locale} />
          {channels.length > 0 ? (
            <div className="channels reveal-group">
              {channels.map((c) => {
                const Icon = CHANNEL_ICON[c.type]
                return (
                  <a key={c.type} href={c.href} className="channel">
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
          ) : null}

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
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const ar = locale === 'ar'

  return (
    <>
      <PageHero
        eyebrow={ar ? 'الأسعار' : 'Pricing'}
        title={p.title}
        lead={p.lead}
        media={{
          src: '/images/pricing-dashboard.png',
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
          <p className="section__note bands__note">{p.bandsNote}</p>
          <div className="bands reveal-group">
            {p.bands.map((b) => (
              <article key={b.name} className={`band${b.featured ? ' band--featured' : ''}`}>
                {/* "الأكثر اختيارًا" was a usage statistic nobody has measured.
                    A recommendation is an opinion we can stand behind. */}
                {b.featured ? (
                  <Pill tone="signal">{ar ? 'نوصي به للبداية' : 'Where we suggest starting'}</Pill>
                ) : null}
                <h2>{b.name}</h2>
                <p className="band__for">{b.forWho}</p>
                <p className="band__volume">{b.volume}</p>
                <ul className="band__includes">
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
                  {ar ? `اطلب تسعير ${b.name}` : `Get quote for ${b.name}`}
                </LinkButton>
              </article>
            ))}
          </div>

          <p className="section__note">{p.note}</p>
        </div>
      </section>

      {/* A page called "الأسعار" that shows no number owes the reader an
          explanation of what the number depends on and when it arrives. */}
      <section className="section">
        <div className="container">
          <SectionHead
            label={ar ? 'كيف نحسبه' : 'How we price'}
            title={p.driversTitle}
            lead={p.driversNote}
          />
          <ul className="drivers reveal-group">
            {p.drivers.map((d) => (
              <li key={d.title} className="driver">
                <strong>{d.title}</strong>
                <p>{d.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'أسئلة عن السعر' : 'Pricing questions'}
            title={ar ? 'قبل أن تسأل.' : 'Before you ask.'}
          />
          <div
            className="faq-panel__items"
            style={{ maxInlineSize: '760px', marginBlockStart: 'var(--s-4)' }}
          >
            {p.faq.map((f) => (
              <details key={f.q} className="faq-item">
                <summary className="faq-item__summary">
                  <strong>{f.q}</strong>
                  <span className="faq-item__icon">
                    <Plus className="icon-plus" size={16} />
                  </span>
                </summary>
                <div className="faq-item__body">
                  <p>{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ─── faq ────────────────────────────────────────────────────────────────── */

export function FaqPage({ locale, initialQuery = '' }: { locale: Locale; initialQuery?: string }) {
  const p = pagesFor(locale).faq
  const ar = locale === 'ar'

  const labels = {
    searchPlaceholder: ar ? 'ابحث عن سؤالك...' : 'Search for your question...',
    searchSuggestions: ar
      ? ['الأسعار', 'واتساب', 'تحويل المكالمات', 'اللهجات']
      : ['Pricing', 'WhatsApp', 'Forwarding', 'Dialects'],
    contactCtaTitle: ar ? 'ما لقيت إجابتك؟' : 'Did not find your answer?',
    contactCtaBody: ar
      ? 'اسأل فريق مُجاوِب مباشرة وسنرد عليك في أقرب وقت.'
      : 'Ask the Mujawib team directly and we will get back to you shortly.',
    contactCtaButton: ar ? 'تواصل معنا' : 'Contact us',
    locale,
  }

  return (
    <>
      <PageHero eyebrow={ar ? 'الأسئلة الشائعة' : 'FAQ'} title={p.title} lead={p.lead}>
        <div className="faq-hero-visual" aria-hidden="true">
          <div className="demo__wave faq-wave">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        </div>
      </PageHero>

      <FaqInteractive groups={p.groups} labels={labels} initialQuery={initialQuery} />
    </>
  )
}

/* ─── about ──────────────────────────────────────────────────────────────── */

export function AboutPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).about
  const ar = locale === 'ar'
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const PRINCIPLE_ICONS = [CheckCircle2, Sparkles, Wrench, ShieldCheck]

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
          <div className="stat-strip reveal">
            <div className="stat-item">
              <span className="stat-item__num">24/7</span>
              <span className="stat-item__label">
                {ar
                  ? 'استقبال فوري وموثوق للمكالمات دون أي توقف'
                  : 'Zero dropped calls around the clock'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-item__num">100%</span>
              <span className="stat-item__label">
                {ar
                  ? 'عزل وتشفير كامل لبيانات منشأتك ومحادثاتك'
                  : 'Tenant isolation & enterprise security'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-item__num">4+</span>
              <span className="stat-item__label">
                {ar
                  ? 'لهجات خليجية وعربية متقنة بنبرة طبيعية'
                  : 'Accents & dialects tuned natively'}
              </span>
            </div>
          </div>

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
          <div className="shields reveal-group" style={{ marginBlockStart: 'var(--s-6)' }}>
            {p.principles.map((pr, idx) => {
              const Icon = PRINCIPLE_ICONS[idx % PRINCIPLE_ICONS.length] ?? CheckCircle2
              return (
                <article key={pr.title} className="can-card">
                  <div className="can-card__icon" aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <h3>{pr.title}</h3>
                  <p>{pr.body}</p>
                </article>
              )
            })}
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

      <section className="section section--tinted">
        <div className="container">
          <div className="page-cta reveal">
            <h2>
              {ar ? 'هل ترغب في تجربة موظفك الصوتي الجديد؟' : 'Ready to hear your AI receptionist?'}
            </h2>
            <p>
              {ar
                ? 'احجز جلسة استشارية أولى مع خبرائنا لنفهم طبيعة نشاطك ونجهز لك تجربة حية على رقم هاتفك.'
                : 'Book a 20-minute discovery call. We listen to your case and prepare a tailored trial call.'}
            </p>
            <div className="page-cta__actions">
              <LinkButton
                href={localePath(locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {ar ? 'احجز جلستك الاستشارية' : 'Book a discovery call'}
              </LinkButton>
            </div>
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
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight
  const PRACTICE_ICONS = [Database, KeyRound, UserCheck, History, CalendarClock, PhoneForwarded]

  return (
    <>
      <PageHero
        eyebrow={ar ? 'الموثوقية والأمان' : 'Security & Reliability'}
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
      >
        <div className="trust-badges">
          <span className="trust-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            {ar ? 'متوافق مع نظام حماية البيانات (PDPL)' : 'Saudi PDPL Compliant'}
          </span>
          <span className="trust-badge">
            <Lock size={16} aria-hidden="true" />
            {ar ? 'تشفير AES-256 و TLS 1.3' : 'AES-256 & TLS 1.3'}
          </span>
          <span className="trust-badge">
            <Database size={16} aria-hidden="true" />
            {ar ? 'عزل كامل لقواعد البيانات' : 'Tenant Database Isolation'}
          </span>
          <span className="trust-badge">
            <Server size={16} aria-hidden="true" />
            {ar ? 'جاهزية سحابية 99.9%' : '99.9% Uptime Cloud'}
          </span>
        </div>
      </PageHero>

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
          <div className="shields reveal-group" style={{ marginBlockStart: 'var(--s-6)' }}>
            {p.practices.map((s, idx) => {
              const Icon = PRACTICE_ICONS[idx % PRACTICE_ICONS.length] ?? ShieldCheck
              return (
                <article key={s.title} className="shield-card">
                  <div className="shield-card__icon" aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              )
            })}
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

      <section className="section section--tinted">
        <div className="container">
          <div className="page-cta reveal">
            <h2>
              {ar
                ? 'هل لديك متطلبات أمان أو امتثال خاصة؟'
                : 'Have custom security or compliance needs?'}
            </h2>
            <p>
              {ar
                ? 'فريقنا الهندسي جاهز لمناقشة اتفاقيات سرية البيانات (NDA)، وتخصيص سياسات الحفظ، وضمان توافق النظام مع متطلبات منشأتك.'
                : 'Our engineering team is ready to discuss NDAs, custom data retention policies, and enterprise security requirements.'}
            </p>
            <div className="page-cta__actions">
              <LinkButton
                href={localePath(locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {ar ? 'تحدث مع فريق الأمن والامتثال' : 'Speak with our security team'}
              </LinkButton>
            </div>
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

/* ─── partners ───────────────────────────────────────────────────────────── */

export function PartnersPage({ locale }: { locale: Locale }) {
  const p = pagesFor(locale).partners
  const ar = locale === 'ar'
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

  return (
    <>
      <PageHero eyebrow={ar ? 'برنامج الشركاء' : 'Partner Program'} title={p.title} lead={p.lead}>
        <div
          style={{
            marginBlockStart: 'var(--s-6)',
            display: 'flex',
            gap: 'var(--s-3)',
            flexWrap: 'wrap',
          }}
        >
          <LinkButton
            href={localePath(locale, '/contact')}
            variant="primary"
            size="lg"
            trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
          >
            {p.ctaButton}
          </LinkButton>
        </div>
      </PageHero>

      {/* Clean, unzoomed natural aspect-ratio banner */}
      <div className="container" style={{ marginBlockEnd: 'var(--s-6)' }}>
        <div className="partner-banner-wrapper reveal">
          <Image
            src="/images/site/partners.png"
            alt={ar ? 'برنامج شركاء مُجاوِب' : 'Mujawib Partner Program'}
            width={1942}
            height={809}
            priority
            className="partner-banner-img"
            sizes="(max-width: 1160px) 100vw, 1160px"
          />
        </div>
      </div>

      {/* Program Highlights */}
      <section className="section" style={{ paddingBlockStart: 0 }}>
        <div className="container">
          <div className="stat-strip reveal">
            {p.stats.map((st) => (
              <div key={st.num} className="stat-item">
                <span className="stat-item__num">{st.num}</span>
                <span className="stat-item__label">{st.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="section">
        <div className="container">
          <SectionHead
            label={ar ? 'المسارات' : 'Tracks'}
            title={p.tracksTitle}
            lead={
              ar
                ? 'اختر نموذج الشراكة الأنسب لطبيعة خدماتك وعملائك لنبني نموذج عمل مربح للطرفين.'
                : 'Choose the partnership model that best fits your business model.'
            }
          />
          <div className="tracks-grid reveal-group">
            {p.tracks.map((track) => (
              <article key={track.title} className="track-card">
                <h3>{track.title}</h3>
                <p>{track.desc}</p>
                <ul className="track-card__features">
                  {track.features.map((feat) => (
                    <li key={feat}>
                      <Check size={15} aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <div className="track-card__who">
                  <span>{ar ? 'الفئة المستهدفة:' : 'Best for:'}</span>
                  <strong>{track.forWho}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'المزايا' : 'Benefits'}
            title={p.benefitsTitle}
            lead={
              ar
                ? 'نوفر لشركائنا الأدوات التشغيلية، والدعم التقني، والعمولات المستمرة لضمان نجاح مشترك.'
                : 'We empower partners with tools, enablement, and compounding commissions.'
            }
          />
          <div className="benefits-grid reveal-group">
            {p.benefits.map((b) => (
              <div key={b.title} className="benefit-card">
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section">
        <div className="container">
          <SectionHead
            label={ar ? 'الخطوات' : 'Process'}
            title={p.stepsTitle}
            lead={
              ar
                ? 'آلية انضمام مبسطة تتيح لك البدء خلال أيام عمل معدودة دون أي تعقيد بيروقراطي.'
                : 'A streamlined onboarding process to get you up and running within days.'
            }
          />
          <div className="partner-steps reveal-group">
            {p.steps.map((s) => (
              <div key={s.n} className="partner-step">
                <span className="partner-step__num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner FAQ */}
      <section className="section section--tinted">
        <div className="container">
          <SectionHead
            label={ar ? 'الأسئلة الشائعة' : 'FAQ'}
            title={p.faqTitle}
            lead={
              ar
                ? 'إجابات واضحة على كل ما يخص العمولات، آلية التعاقد، والدعم الفني.'
                : 'Everything you need to know about payouts, contracting, and support.'
            }
          />
          <div
            className="faq-panel__items"
            style={{ maxInlineSize: '820px', marginBlockStart: 'var(--s-5)' }}
          >
            {p.faq.map((f) => (
              <details key={f.q} className="faq-item">
                <summary className="faq-item__summary">
                  <strong>{f.q}</strong>
                  <span className="faq-item__icon">
                    <Plus className="icon-plus" size={16} />
                  </span>
                </summary>
                <div className="faq-item__body">
                  <p>{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="page-cta reveal">
            <h2>{p.ctaTitle}</h2>
            <p>{p.ctaBody}</p>
            <div className="page-cta__actions">
              <LinkButton
                href={localePath(locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {p.ctaButton}
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
