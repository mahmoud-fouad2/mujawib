/**
 * Pure checks for the app's own public URL, kept separate from env.ts on
 * purpose: env.ts validates the *entire* environment as a side effect of
 * being imported, which would drag a database URL and a dozen other
 * variables into what should be two small, args-in-args-out functions. See
 * lib/env.test.ts for why these exist and app-url.test.ts for the coverage.
 */

export function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)
}

/**
 * Null when the two URLs are production-safe and consistent; otherwise the
 * exact reason, ready to throw or log.
 */
export function appUrlProblem(betterAuthUrl: string, publicAppUrl: string): string | null {
  if (isLocalUrl(betterAuthUrl)) {
    return (
      `BETTER_AUTH_URL is set to "${betterAuthUrl}" in production. This must be the public URL ` +
      'of this service (e.g. https://mujawib.onrender.com) — Better Auth uses it to build every ' +
      'redirect, so a localhost value sends every signed-in browser nowhere. Fix it in the ' +
      'Render dashboard, not in code.'
    )
  }
  if (isLocalUrl(publicAppUrl)) {
    return (
      `NEXT_PUBLIC_APP_URL is set to "${publicAppUrl}" in production. Same fix: set it to the ` +
      'public URL of this service in the Render dashboard.'
    )
  }
  if (betterAuthUrl !== publicAppUrl) {
    return (
      `BETTER_AUTH_URL ("${betterAuthUrl}") and NEXT_PUBLIC_APP_URL ("${publicAppUrl}") ` +
      'disagree. render.yaml requires both to equal the same public URL — set them to match in ' +
      'the Render dashboard.'
    )
  }
  return null
}
