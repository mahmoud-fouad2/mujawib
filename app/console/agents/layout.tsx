import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function AgentsLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('agent.publish', '/console/agents')
  return children
}
