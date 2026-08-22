import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function TestLabLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('test.manage', '/console/test-lab')
  return children
}
