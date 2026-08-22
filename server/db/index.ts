import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

function errorChain(error: unknown, depth = 0): string {
  if (depth > 5 || error === null || error === undefined) return ''
  if (error instanceof Error) {
    const nested = error instanceof AggregateError ? error.errors : error.cause
    return `${error.name} ${error.message} ${errorChain(nested, depth + 1)}`
  }
  if (Array.isArray(error)) return error.map((item) => errorChain(item, depth + 1)).join(' ')
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>
    return [record.cause, record.sourceError, record.errors]
      .map((item) => errorChain(item, depth + 1))
      .join(' ')
  }
  return String(error)
}

export function isDatabaseUnavailable(error: unknown): boolean {
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|network|connection terminated|57P01|57P03/i.test(
    errorChain(error),
  )
}

type SqlClient = ReturnType<typeof postgres>
const globalForDatabase = globalThis as typeof globalThis & { mujawibSql?: SqlClient }

const sqlClient =
  globalForDatabase.mujawibSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === 'production' ? 10 : 4,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    prepare: false,
  })

if (env.NODE_ENV !== 'production') globalForDatabase.mujawibSql = sqlClient

export const db = drizzle(sqlClient, { schema })
