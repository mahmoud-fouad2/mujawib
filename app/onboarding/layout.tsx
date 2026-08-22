import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('client.manage', '/onboarding')
  return children
}
