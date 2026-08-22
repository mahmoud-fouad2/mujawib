import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function PhoneLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('phone.manage', '/console/phone')
  return children
}
