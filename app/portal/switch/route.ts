import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getPortalAccess, PORTAL_WORKSPACE_COOKIE } from '@/server/auth/access'

/** See app/auth/continue/route.ts — request.url reflects Render's internal
 *  proxy address, not the public site, so redirects must be built from
 *  NEXT_PUBLIC_APP_URL instead. */
function toPublicUrl(path: string): URL {
  return new URL(path, env.NEXT_PUBLIC_APP_URL)
}

/**
 * The console's "open this client's portal" links and the portal's own
 * workspace switcher both point here with `?client=<slug>`. Setting the
 * workspace cookie requires a Route Handler or Server Action — a layout or
 * page render cannot do it — so this is the one place a portal workspace
 * switch actually takes effect, no matter which slug was last requested.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('client')
  if (!slug) return NextResponse.redirect(toPublicUrl('/portal'))

  const access = await getPortalAccess(slug)
  if (!access) {
    return NextResponse.redirect(toPublicUrl('/access-denied?area=portal'))
  }

  const response = NextResponse.redirect(toPublicUrl('/portal'))
  response.cookies.set(PORTAL_WORKSPACE_COOKIE, access.workspace.slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
