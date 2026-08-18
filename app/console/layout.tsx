import type { Metadata } from 'next'
import { ConsoleShell } from '@/components/console/shell'
import { requireSession } from '@/server/auth/session'
import { getCommandIndex, getNavCounts } from '@/server/data/console'

export const metadata: Metadata = {
  title: 'لوحة التشغيل',
  description: 'متابعة المكالمات المباشرة، العملاء، الموظفين الصوتيين، الجودة والربط.',
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Authoritative check — the middleware only sees whether a cookie exists.
  await requireSession('/console')

  const [counts, index] = await Promise.all([getNavCounts(), getCommandIndex()])

  return (
    <ConsoleShell counts={counts} index={index}>
      {children}
    </ConsoleShell>
  )
}
