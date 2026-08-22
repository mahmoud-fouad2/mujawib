import { requireOperatorPermissionPage } from '@/server/auth/access'

export default async function VoiceLabLayout({ children }: { children: React.ReactNode }) {
  await requireOperatorPermissionPage('voice.manage', '/console/voice-lab')
  return children
}
