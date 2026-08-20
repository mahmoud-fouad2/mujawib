import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

/**
 * Importing `env` here validates the whole server environment the first time
 * anything touches the database — which is every request path. A missing or
 * malformed DATABASE_URL fails at boot naming the variable, instead of
 * surfacing as an opaque connection error on the first query.
 */

const CONNECT_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3

/**
 * Neon on a scale-to-zero branch parks after a few minutes idle, and the first
 * request afterwards has to wait for the compute to wake. That wake can exceed
 * the default fetch timeout and surface as ETIMEDOUT, which is what was taking
 * pages down in production.
 *
 * Retrying with backoff covers the wake and any transient network blip. Only
 * connection-level failures are retried — a genuine SQL error is thrown on the
 * first attempt, because repeating a bad query just delays the real message.
 */
function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : ''
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
    message,
  )
}

const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      })
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break
      // 250ms, then 750ms — long enough for a cold branch to come up.
      await new Promise((r) => setTimeout(r, 250 * 3 ** (attempt - 1)))
    }
  }

  throw lastError
}

// The custom fetch is installed on the driver config, not per-connection.
neonConfig.fetchFunction = resilientFetch

const sql = neon(env.DATABASE_URL)

export const db = drizzle({ client: sql, schema })

export type Database = typeof db
