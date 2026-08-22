import type { Metadata } from 'next'
import { PortalShell } from '@/components/portal/portal-shell'
import { requirePortalPage } from '@/server/auth/access'
import { getNotificationsForCurrentUser } from '@/server/data/notifications'
import { getPortalAgentHealth } from '@/server/data/portal'

export const metadata: Metadata = {
  title: 'بوابة العميل',
  description: 'ماذا حدث في مكالماتك، وماذا أنجزه الصوت، وما الذي يحتاج تدخلك.',
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { workspace } = await requirePortalPage('/portal')

  const [health, notifications] = await Promise.all([
    getPortalAgentHealth(workspace.id),
    getNotificationsForCurrentUser({ workspaceId: workspace.id }),
  ])

  return (
    <PortalShell
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      health={{ state: health.state, label: health.label }}
      notifications={notifications}
    >
      {children}
    </PortalShell>
  )
}
