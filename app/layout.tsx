import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'مُجاوِب — منصة تشغيل صوتي عربي بالذكاء الاصطناعي',
  description:
    'MUJAWIB — منصة B2B مُدارة لتشغيل موظفي استقبال وخدمة عملاء صوتيين بالعربية: إعداد Agent مضبوط، جودة صوت عربية، وربط فعلي بالحجز والأنظمة.',
}

export const viewport = {
  themeColor: '#0B0D10',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-color-mode="dark"
      data-light-theme="light"
      data-dark-theme="dark"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
