import { type NextRequest, NextResponse } from 'next/server'
import { resolveAuthDestination } from '@/lib/auth-policy'
import { getOperatorAccess, getPortalAccess } from '@/server/auth/access'
import { getSession } from '@/server/auth/session'

function safeNext(value: string | null): string | null {
  if (!value?.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    const next = safeNext(request.nextUrl.searchParams.get('next'))
    const url = new URL('/sign-in', request.url)
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  const requested = safeNext(request.nextUrl.searchParams.get('next'))
  const [operator, portal] = await Promise.all([getOperatorAccess(), getPortalAccess()])
  const destination = resolveAuthDestination({
    requested,
    hasOperatorAccess: Boolean(operator),
    hasPortalAccess: Boolean(portal),
  })
  return NextResponse.redirect(new URL(destination, request.url))
}
