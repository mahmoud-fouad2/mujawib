import type { Metadata } from 'next'
import { env } from '@/lib/env'
import { type Locale, localePath } from '@/lib/i18n'
import type { PlatformContact } from '@/server/data/platform'

export const SITE_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

const ORG_NAME_AR = 'مُجاوِب'
const ORG_NAME_EN = 'Mujawib'

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
 *
 * `email`/`telephone` are likewise only included once `contact` says the
 * channel is confirmed — an unconfirmed one is omitted rather than published
 * as structured data a search engine treats as verified business fact.
 */
export function organizationSchema(locale: Locale, contact: PlatformContact) {
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
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.phone ? { telephone: contact.phone.e164 } : {}),
    areaServed: ['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM'],
    knowsLanguage: ['ar', 'en'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: ar ? 'المبيعات' : 'sales',
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.phone ? { telephone: contact.phone.e164 } : {}),
        availableLanguage: ['ar', 'en'],
        areaServed: ['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM'],
      },
    ],
  }
}

export function websiteSchema(locale: Locale) {
  const ar = locale === 'ar'
  const searchUrl = `${SITE_URL}${localePath(locale, '/faq')}?q={search_term_string}`

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: ar ? ORG_NAME_AR : ORG_NAME_EN,
    alternateName: ar
      ? ['مجاوب', 'منصة مجاوب', 'Mujawib', 'Mujawib Voice AI']
      : ['Mujawib', 'Mujawib AI', 'Mujawib Arabic Voice Receptionist'],
    inLanguage: ar ? 'ar-SA' : 'en',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrl,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** Google Sitelinks Navigation schema to encourage rich sitelinks under the main search snippet. */
export function siteNavigationSchema(locale: Locale) {
  const ar = locale === 'ar'
  const items = ar
    ? [
        { name: 'كيف نبدأ معك', url: absolute('/how-it-works') },
        { name: 'الأسعار والباقات', url: absolute('/pricing') },
        { name: 'برنامج الشركاء', url: absolute('/partners') },
        { name: 'الأمان والموثوقية', url: absolute('/security') },
        { name: 'الأسئلة الشائعة', url: absolute('/faq') },
        { name: 'من نحن', url: absolute('/about') },
        { name: 'تواصل معنا', url: absolute('/contact') },
      ]
    : [
        { name: 'How It Works', url: absolute('/en/how-it-works') },
        { name: 'Pricing & Plans', url: absolute('/en/pricing') },
        { name: 'Partner Program', url: absolute('/en/partners') },
        { name: 'Security & Privacy', url: absolute('/en/security') },
        { name: 'FAQ', url: absolute('/en/faq') },
        { name: 'About Us', url: absolute('/en/about') },
        { name: 'Contact Us', url: absolute('/en/contact') },
      ]

  return {
    '@context': 'https://schema.org',
    '@graph': items.map((item, idx) => ({
      '@type': 'SiteNavigationElement',
      position: idx + 1,
      name: item.name,
      url: item.url,
    })),
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
    operatingSystem: 'Cloud, Web, Telephony (SIP)',
    inLanguage: ['ar', 'en'],
    provider: { '@id': `${SITE_URL}/#organization` },
    screenshot: absolute(ogCard(locale)),
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

export function contactPageSchema(locale: Locale, contact: PlatformContact) {
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
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { telephone: contact.phone.e164 } : {}),
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

/**
 * Article structured data.
 *
 * Google needs `datePublished` and a real author to treat a page as an
 * article rather than a generic document, and `inLanguage` matters more than
 * usual here because the corpus is Arabic and the domain also serves English.
 * Everything below is asserted from the row, never invented: an article with
 * no publish date does not get a schema at all rather than a fabricated one.
 */
export function articleSchema(input: {
  slug: string
  title: string
  description: string
  publishedAt: Date
  updatedAt: Date
  authorName: string | null
  keywords: string[]
  locale: Locale
}) {
  const url = absolute(localePath(input.locale, `/blog/${input.slug}`))
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    inLanguage: input.locale === 'ar' ? 'ar-SA' : 'en-US',
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.updatedAt.toISOString(),
    ...(input.keywords.length > 0 ? { keywords: input.keywords.join(', ') } : {}),
    author: { '@type': 'Organization', name: input.authorName ?? ORG_NAME_AR },
    publisher: {
      '@type': 'Organization',
      name: input.locale === 'ar' ? ORG_NAME_AR : ORG_NAME_EN,
      url: SITE_URL,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  }
}

/** Breadcrumbs for an article, so the result shows the section not a bare URL. */
export function articleBreadcrumbSchema(input: { slug: string; title: string; locale: Locale }) {
  const blogUrl = absolute(localePath(input.locale, '/blog'))
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: input.locale === 'ar' ? 'المدونة' : 'Blog',
        item: blogUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: input.title,
        item: absolute(localePath(input.locale, `/blog/${input.slug}`)),
      },
    ],
  }
}
