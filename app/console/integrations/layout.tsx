import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('integration.manage', '/console/integrations')
  return children
}
