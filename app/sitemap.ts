import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/** Public marketing routes only — the console and portal sit behind auth. */
const ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/partners', priority: 0.85, changeFrequency: 'monthly' as const },
  { path: '/faq', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/about', priority: 0.6, changeFrequency: 'yearly' as const },
  { path: '/contact', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
]

/** Arabic pages are at the root; English mirrors live under /en. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Deterministic release timestamp to avoid spurious crawl signals
  const lastModified = new Date('2026-08-27T12:00:00.000Z')

  return ROUTES.flatMap(({ path, priority, changeFrequency }) => {
    const ar = `${SITE_URL}${path}`
    const en = `${SITE_URL}${path === '/' ? '/en' : `/en${path}`}`
    const languages = {
      ar,
      'ar-SA': ar,
      en,
      'en-US': en,
      'x-default': ar,
    }

    return [
      { url: ar, lastModified, changeFrequency, priority, alternates: { languages } },
      {
        url: en,
        lastModified,
        changeFrequency,
        priority: Number((priority * 0.9).toFixed(2)),
        alternates: { languages },
      },
    ]
  })
}
