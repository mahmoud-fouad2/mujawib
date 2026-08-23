import 'server-only'

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function encryptionKey(): Buffer {
  const configured = env.DATA_ENCRYPTION_KEY?.trim()
  if (!configured) throw new Error('DATA_ENCRYPTION_KEY is required for protected data')

  if (/^[a-f\d]{64}$/i.test(configured)) {
    return Buffer.from(configured, 'hex')
  }

  if (/^[A-Za-z\d+/_=-]{43,44}$/.test(configured)) {
    const decoded = Buffer.from(configured, 'base64url')
    if (decoded.length === 32) return decoded
  }

  // Render and other secret stores commonly generate opaque passphrases
  // rather than encoded binary. Key derivation keeps that input stable while
  // separating protected payloads from Better Auth's own signing use.
  return createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update('mujawib:protected-data:v1\0', 'utf8')
    .update(configured, 'utf8')
    .digest()
}

export function protectedDataReady() {
  try {
    encryptionKey()
    return true
  } catch {
    return false
  }
}

/**
 * A short, one-way fingerprint of the key actually protecting stored data —
 * safe to log or persist, unlike the key itself.
 *
 * `DATA_ENCRYPTION_KEY` derives through `BETTER_AUTH_SECRET` whenever it is
 * configured as an opaque passphrase rather than raw key bytes (see
 * `encryptionKey` above), so this fingerprint moves if either input changes.
 * That coupling is exactly what makes it worth tracking: a `BETTER_AUTH_SECRET`
 * rotation can silently change this key too, and everything protected under
 * the old one — caller numbers, transcripts, tool payloads — starts reading
 * back as `null` with no error, because `revealString` fails closed. Compared
 * against a fingerprint recorded at last boot, a change here is the one signal
 * that actually says so.
 */
export function dataEncryptionKeyFingerprint(): string | null {
  try {
    return createHash('sha256').update(encryptionKey()).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

export function protectString(value: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  cipher.setAAD(Buffer.from(`mujawib:${VERSION}`, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function revealString(value: string | null | undefined): string | null {
  if (!value) return null
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) return null

  try {
    const iv = Buffer.from(ivValue, 'base64url')
    const tag = Buffer.from(tagValue, 'base64url')
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv)
    decipher.setAAD(Buffer.from(`mujawib:${VERSION}`, 'utf8'))
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

export function protectJson(value: unknown): string {
  return protectString(JSON.stringify(value))
}

export function revealJson<T>(value: string | null | undefined, fallback: T): T {
  const plaintext = revealString(value)
  if (!plaintext) return fallback
  try {
    return JSON.parse(plaintext) as T
  } catch {
    return fallback
  }
}

export function protectedLookup(value: string): string {
  return createHmac('sha256', encryptionKey()).update(value.trim(), 'utf8').digest('hex')
}
