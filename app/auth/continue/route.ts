import { type NextRequest, NextResponse } from 'next/server'
import { resolveAuthDestination } from '@/lib/auth-policy'
import { env } from '@/lib/env'
import { safeInternalPath } from '@/lib/navigation'
import { getOperatorAccess, getPortalAccess } from '@/server/auth/access'
import { getSession } from '@/server/auth/session'

/**
 * `request.url` is not the site's public address here — behind Render's
 * proxy it reflects the container's own internal address (localhost:PORT),
 * so every redirect built from it sent a signed-in browser to a URL that
 * does not exist outside the container. `env.NEXT_PUBLIC_APP_URL` is the
 * one place that address is actually configured; `safeInternalPath` has
 * already guaranteed `path` is a bare same-origin path, so combining them
 * cannot be redirected off-site.
 */
function toPublicUrl(path: string): URL {
  return new URL(path, env.NEXT_PUBLIC_APP_URL)
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    const next = safeInternalPath(request.nextUrl.searchParams.get('next'), null)
    const url = toPublicUrl('/sign-in')
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  const requested = safeInternalPath(request.nextUrl.searchParams.get('next'), null)
  const [operator, portal] = await Promise.all([getOperatorAccess(), getPortalAccess()])
  const destination = resolveAuthDestination({
    requested,
    hasOperatorAccess: Boolean(operator),
    hasPortalAccess: Boolean(portal),
  })
  return NextResponse.redirect(toPublicUrl(destination))
}
