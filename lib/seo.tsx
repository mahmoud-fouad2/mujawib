import type { Metadata } from 'next'
import { type Locale, localePath } from '@/lib/i18n'

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mujawib.onrender.com').replace(
  /\/$/,
  '',
)

export const ORG_NAME_AR = 'مُجاوِب'
export const ORG_NAME_EN = 'Mujawib'
export const ORG_EMAIL = 'hello@mujawib.com'
export const ORG_PHONE = '+966920012130'

export function absolute(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
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
      languages: { ar: arUrl, en: enUrl, 'x-default': arUrl },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: locale === 'ar' ? ORG_NAME_AR : ORG_NAME_EN,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
      title,
      description,
      images: [{ url: absolute('/images/brand/logo-horizontal-hq.png'), width: 1319, height: 382 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absolute('/images/brand/logo-horizontal-hq.png')],
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
    offers: {
      '@type': 'Offer',
      priceCurrency: 'SAR',
      // Quote-based: we publish that price is on request rather than a number
      // we would have to invent.
      price: '0',
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
