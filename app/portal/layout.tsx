import type { Metadata } from 'next'
import { PortalShell } from '@/components/portal/portal-shell'
import { getPortalWorkspacesForCurrentUser, requirePortalPage } from '@/server/auth/access'
import { getNotificationsForCurrentUser } from '@/server/data/notifications'
import { getPortalAgentHealth } from '@/server/data/portal'

export const metadata: Metadata = {
  title: 'بوابة العميل',
  description: 'ماذا حدث في مكالماتك، وماذا أنجزه الصوت، وما الذي يحتاج تدخلك.',
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortalPage('/portal')
  const { workspace } = access

  const [health, notifications, workspaces] = await Promise.all([
    getPortalAgentHealth(workspace.id),
    getNotificationsForCurrentUser({ workspaceId: workspace.id }),
    getPortalWorkspacesForCurrentUser(),
  ])

  return (
    <PortalShell
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
      workspaces={workspaces.map(({ id, name, slug }) => ({ id, name, slug }))}
      user={{ name: access.name, email: access.email }}
      viewingAsOperator={access.viewingAsOperator === true}
      health={{ state: health.state, label: health.label }}
      notifications={notifications}
    >
      {children}
    </PortalShell>
  )
}
