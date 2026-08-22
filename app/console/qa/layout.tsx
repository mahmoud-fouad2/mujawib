import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function QaLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('qa.review', '/console/qa')
  return children
}
