import 'server-only'

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'
import { env } from '@/lib/env'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function encryptionKey(): Buffer {
  const configured = env.DATA_ENCRYPTION_KEY
  if (!configured) throw new Error('DATA_ENCRYPTION_KEY is required for protected data')

  const key = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64')
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  return key
}

export function protectedDataReady() {
  try {
    encryptionKey()
    return true
  } catch {
    return false
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
