import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('system.view', '/console/system')
  return children
}
