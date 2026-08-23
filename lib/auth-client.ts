import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * No `twoFactorPage` here on purpose. That option hard-navigates to a fixed
 * URL from inside the fetch hook, which drops the `next` the caller was
 * carrying and races the caller's own navigation. Each sign-in surface reads
 * `twoFactorRedirect` off the response instead — see `twoFactorHref`.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient({}), twoFactorClient({})],
})

/** True when the password was right and Better Auth is now holding a 2FA challenge. */
export function needsTwoFactor(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && 'twoFactorRedirect' in data)
}

/** The challenge page, carrying wherever the person was heading. */
export function twoFactorHref(next?: string | null): string {
  return next ? `/two-factor?next=${encodeURIComponent(next)}` : '/two-factor'
}
