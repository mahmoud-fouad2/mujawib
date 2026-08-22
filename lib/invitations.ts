import { type AccessRole, isClientRole, isOperatorRole } from '@/lib/access'

export const INVITATION_TTL_DAYS = 7

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function roleFitsWorkspace(
  role: string,
  workspaceType: 'operator' | 'client',
): role is AccessRole {
  return workspaceType === 'operator' ? isOperatorRole(role) : isClientRole(role)
}

export function isInvitationOpen(status: string, expiresAt: Date, now = new Date()): boolean {
  return status === 'pending' && expiresAt.getTime() > now.getTime()
}

export function maskInvitationEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}
