import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('content.manage', '/console/content')
  return children
}
