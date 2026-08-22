export const MANAGED_AUTH_POLICY = {
  publicEmailSignUp: false,
  publicSocialSignUp: false,
} as const

export type AuthDestinationInput = {
  requested: string | null
  hasOperatorAccess: boolean
  hasPortalAccess: boolean
}

export function resolveAuthDestination({
  requested,
  hasOperatorAccess,
  hasPortalAccess,
}: AuthDestinationInput): string {
  if (requested === '/invite') return '/invite'
  if (requested?.startsWith('/console') && hasOperatorAccess) return requested
  if (requested?.startsWith('/portal') && hasPortalAccess) return requested
  if (requested?.startsWith('/onboarding') && hasOperatorAccess) return requested
  if (hasOperatorAccess) return '/console'
  if (hasPortalAccess) return '/portal'
  return '/access-pending'
}
