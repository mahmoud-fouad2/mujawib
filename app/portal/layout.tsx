import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PortalShell } from '@/components/portal/portal-shell'
import { requireSession } from '@/server/auth/session'
import { getPortalAgentHealth, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = {
  title: 'بوابة العميل',
  description: 'ماذا حدث في مكالماتك، وماذا أنجزه الصوت، وما الذي يحتاج تدخلك.',
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireSession('/portal')

  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const health = await getPortalAgentHealth(workspace.id)

  return (
    <PortalShell
      workspaceName={workspace.name}
      health={{ state: health.state, label: health.label }}
    >
      {children}
    </PortalShell>
  )
}
