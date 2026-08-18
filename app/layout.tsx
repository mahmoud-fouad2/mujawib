import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
// Load order is the cascade: tokens, then the reset and primitives, then the
// three surfaces, then the overlays that sit above all of them.
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/site.css'
import './styles/app-shell.css'
import './styles/auth.css'
import './styles/actions.css'

import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Providers } from '@/components/providers'
import { themeInitScript } from '@/components/ui/theme'
import { dirOf, type Locale } from '@/lib/i18n'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'مُجاوِب — تشغيل صوتي عربي للشركات',
    template: '%s — مُجاوِب',
  },
  description:
    'منصة B2B مُدارة لتشغيل موظفي استقبال وخدمة عملاء صوتيين بالعربية: إعداد مضبوط، جودة صوت مختبَرة، وربط فعلي بالحجز والأنظمة.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F7F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0D10' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by middleware — decides direction on the server, before first paint.
  const locale = ((await headers()).get('x-locale') ?? 'ar') as Locale

  return (
    <html lang={locale} dir={dirOf(locale)} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the stored colour mode before paint so the ground never flashes. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: must run before hydration
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
