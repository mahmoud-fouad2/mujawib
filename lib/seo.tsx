import type { Metadata } from 'next'
import { CONTACT } from '@/lib/content/contact'
import { env } from '@/lib/env'
import { type Locale, localePath } from '@/lib/i18n'

export const SITE_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

const ORG_NAME_AR = 'مُجاوِب'
const ORG_NAME_EN = 'Mujawib'
const ORG_EMAIL = CONTACT.email
const ORG_PHONE = CONTACT.phoneE164

function absolute(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * The link preview card, built by `pnpm og:build`.
 *
 * `summary_large_image` is rendered at about 1.91:1. Pointing it at the
 * wordmark meant handing every platform a 3.45:1 strip to crop, which on
 * WhatsApp — where these links actually get sent — left a sliver of logo and
 * nothing that said what the product does.
 */
function ogCard(locale: Locale) {
  return `/images/brand/og-card-${locale}.png`
}

/**
 * Metadata for a marketing page, including the hreflang pair.
 *
 * Both locales are always declared and point at each other, so a search engine
 * that finds one finds the other. `x-default` goes to Arabic, the primary
 * market.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale
  path: string
  title: string
  description: string
}): Metadata {
  const arUrl = absolute(localePath('ar', path))
  const enUrl = absolute(localePath('en', path))
  const canonical = locale === 'ar' ? arUrl : enUrl

  return {
    title: locale === 'en' ? { absolute: `${title} — ${ORG_NAME_EN}` } : title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: arUrl,
        'ar-SA': arUrl,
        en: enUrl,
        'en-US': enUrl,
        'x-default': arUrl,
      },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: locale === 'ar' ? ORG_NAME_AR : ORG_NAME_EN,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
      title,
      description,
      images: [{ url: absolute(ogCard(locale)), width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absolute(ogCard(locale))],
    },
    other: {
      'geo.region': 'SA-01',
      'geo.placename': 'Riyadh',
      'geo.position': '24.7136;46.6753',
      ICBM: '24.7136, 46.6753',
    },
  }
}

/* ─── structured data ────────────────────────────────────────────────────── */

/**
 * Organisation and site identity. Deliberately no `aggregateRating`: star
 * ratings in search results require genuine, collected reviews, and inventing
 * them is both against Google's guidelines and untrue.
 */
export function organizationSchema(locale: Locale) {
  const ar = locale === 'ar'
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: ar ? ORG_NAME_AR : ORG_NAME_EN,
    alternateName: ar ? ORG_NAME_EN : ORG_NAME_AR,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absolute('/images/brand/logo-horizontal-hq.png'),
      width: 1319,
      height: 382,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Riyadh',
      addressRegion: 'Riyadh Province',
      addressCountry: 'SA',
    },
    description: ar
      ? 'منصة عربية لإدارة المكالمات الواردة بموظف صوتي يفهم العربية وينفّذ الحجز والتحويل داخل أنظمة الشركة.'
      : 'An Arabic voice platform that answers inbound business calls, completes bookings and transfers inside your systems.',
    email: ORG_EMAIL,
    telephone: ORG_PHONE,
    areaServed: ['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM'],
    knowsLanguage: ['ar', 'en'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: ar ? 'المبيعات' : 'sales',
        email: ORG_EMAIL,
        telephone: ORG_PHONE,
        availableLanguage: ['ar', 'en'],
        areaServed: ['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM'],
      },
    ],
  }
}

export function websiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: locale === 'ar' ? ORG_NAME_AR : ORG_NAME_EN,
    inLanguage: locale === 'ar' ? 'ar-SA' : 'en',
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

/** The product itself, described as software with a quote-based price. */
export function serviceSchema(locale: Locale) {
  const ar = locale === 'ar'
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: ar ? 'مُجاوِب — موظف استقبال صوتي عربي' : 'Mujawib — Arabic voice receptionist',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['ar', 'en'],
    provider: { '@id': `${SITE_URL}/#organization` },
    description: ar
      ? 'يرد على مكالمات الشركة بالعربية على مدار الساعة، يحجز المواعيد في التقويم، يرسل التأكيد، ويحوّل للموظف عند الحاجة.'
      : 'Answers business calls in Arabic around the clock, books appointments in your calendar, sends confirmations, and hands over to a person when needed.',
    featureList: ar
      ? [
          'رد صوتي عربي بلهجات متعددة',
          'حجز وتعديل وإلغاء المواعيد',
          'ربط Google Calendar وMicrosoft 365',
          'تأكيد عبر واتساب',
          'تحويل للموظف مع سياق المكالمة',
          'سجل كامل لكل مكالمة',
        ]
      : [
          'Arabic voice answering across dialects',
          'Booking, rescheduling and cancellation',
          'Google Calendar and Microsoft 365',
          'WhatsApp confirmation',
          'Handover with full call context',
          'A complete record per call',
        ],
    // Quote-based. `price: '0'` used to sit here, which tells a search engine
    // the product is free — a claim we would then have to walk back on the
    // pricing page. A PriceSpecification with no figure says "on request",
    // which is the truth.
    offers: {
      '@type': 'Offer',
      priceCurrency: 'SAR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'SAR',
        valueAddedTaxIncluded: false,
        description: ar ? 'السعر حسب حجم المكالمات' : 'Priced on call volume',
      },
      availability: 'https://schema.org/InStock',
      url: absolute(localePath(locale, '/pricing')),
    },
  }
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  }
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absolute(t.path),
    })),
  }
}

export function contactPageSchema(locale: Locale) {
  const ar = locale === 'ar'
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${SITE_URL}${localePath(locale, '/contact')}#webpage`,
    url: `${SITE_URL}${localePath(locale, '/contact')}`,
    name: ar ? 'تواصل مع مُجاوِب' : 'Contact Mujawib',
    description: ar
      ? 'تواصل مع فريق مُجاوِب لحجز استشارة تجريبية ومناقشة سيناريوهات الاستقبال الصوتي لمنشأتك.'
      : 'Contact the Mujawib team to book a live demo and discuss voice AI reception for your business.',
    mainEntity: {
      '@type': 'Organization',
      name: ar ? ORG_NAME_AR : ORG_NAME_EN,
      email: ORG_EMAIL,
      telephone: ORG_PHONE,
    },
  }
}

/** Renders one or more schema objects as a single JSON-LD script. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has to be inlined
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
