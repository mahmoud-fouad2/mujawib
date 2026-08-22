import type { Metadata } from 'next'
import { ConsoleShell } from '@/components/console/shell'
import { requireOperatorPage } from '@/server/auth/access'
import { getCommandIndex, getNavCounts } from '@/server/data/console'
import { getNotificationsForCurrentUser } from '@/server/data/notifications'

export const metadata: Metadata = {
  title: 'لوحة التشغيل',
  description: 'متابعة المكالمات المباشرة، العملاء، الموظفين الصوتيين، الجودة والربط.',
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Authoritative identity + role check; middleware only performs the cheap cookie gate.
  const access = await requireOperatorPage('/console')

  const [counts, index, notifications] = await Promise.all([
    getNavCounts(),
    getCommandIndex(access.role),
    getNotificationsForCurrentUser(),
  ])

  return (
    <ConsoleShell counts={counts} index={index} role={access.role} notifications={notifications}>
      {children}
    </ConsoleShell>
  )
}
