import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

/** Everything behind sign-in. */
const PROTECTED = ['/console', '/portal', '/onboarding']

/**
 * Two jobs, both of which have to happen before the page renders:
 *
 *  1. Resolve the locale and pass it to the root layout, so `dir` and `lang`
 *     are correct in the first byte rather than patched in an effect.
 *  2. Keep unauthenticated traffic off the console and portal. This is an
 *     optimistic cookie check — the authoritative session lookup runs in the
 *     layouts, since a cookie can exist without being valid.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const sessionCookie = getSessionCookie(request)
    if (!sessionCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      url.search = `?next=${encodeURIComponent(pathname)}`
      return NextResponse.redirect(url)
    }
  }

  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ar'

  const headers = new Headers(request.headers)
  headers.set('x-locale', locale)
  headers.set('x-pathname', pathname)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|images|fonts).*)',
  ],
}
