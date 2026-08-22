import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function TemplatesLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('client.manage', '/console/templates')
  return children
}
