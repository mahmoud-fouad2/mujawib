import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createInvitationToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString('base64url')
  return { raw, hash: hashInvitationToken(raw) }
}

export function buildInvitationUrl(baseUrl: string, token: string): string {
  const url = new URL('/invite', baseUrl)
  url.hash = `token=${encodeURIComponent(token)}`
  return url.toString()
}
