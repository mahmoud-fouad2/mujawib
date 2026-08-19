import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/** Public marketing routes only — the console and portal sit behind auth. */
const ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/faq', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/about', priority: 0.6, changeFrequency: 'yearly' as const },
  { path: '/contact', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
]

/** Arabic pages are at the root; English mirrors live under /en. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return ROUTES.flatMap(({ path, priority, changeFrequency }) => {
    const ar = `${SITE_URL}${path}`
    const en = `${SITE_URL}${path === '/' ? '/en' : `/en${path}`}`
    const languages = { ar, en, 'x-default': ar }

    return [
      { url: ar, lastModified: now, changeFrequency, priority, alternates: { languages } },
      {
        url: en,
        lastModified: now,
        changeFrequency,
        priority: priority * 0.9,
        alternates: { languages },
      },
    ]
  })
}
