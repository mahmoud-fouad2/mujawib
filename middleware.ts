import { type NextRequest, NextResponse } from 'next/server'

/** Everything behind sign-in. */
const PROTECTED = ['/console', '/portal', '/onboarding']

/**
 * Better Auth's cookie name. Read directly rather than through
 * `getSessionCookie`, because importing that pulls the whole auth library —
 * and `jose`, which references CompressionStream — into the Edge bundle. This
 * check is optimistic by design (the layouts do the authoritative lookup), so
 * it only needs to know whether a cookie is present.
 */
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token']

/**
 * Two jobs, both of which have to happen before the page renders:
 *
 *  1. Resolve the locale and pass it to the root layout, so `dir` and `lang`
 *     are correct in the first byte rather than patched in an effect.
 *  2. Keep unauthenticated traffic off the console and portal.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
    if (!hasSession) {
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
