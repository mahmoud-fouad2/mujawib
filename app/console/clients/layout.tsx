import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('client.manage', '/console/clients')
  return children
}
