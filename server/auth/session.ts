import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/server/auth'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/**
 * Guards a server route. The middleware already does a cheap cookie check to
 * keep unauthenticated traffic off these paths; this is the authoritative one,
 * because a cookie can be present without being valid.
 */
export async function requireSession(returnTo?: string) {
  const session = await getSession()
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''
    redirect(`/sign-in${next}`)
  }
  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}
