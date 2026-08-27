import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const privateRoutes = [
    '/console',
    '/portal',
    '/onboarding',
    '/sign-in',
    '/forgot-password',
    '/reset-password',
    '/two-factor',
    '/access-denied',
    '/access-pending',
    '/account',
    '/invite',
    '/api/',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/llms-full.txt'],
        disallow: privateRoutes,
      },
      {
        userAgent: [
          'Googlebot',
          'Bingbot',
          'Applebot',
          'GPTBot',
          'PerplexityBot',
          'ClaudeBot',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: ['/', '/llms.txt', '/llms-full.txt'],
        disallow: privateRoutes,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
