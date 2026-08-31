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

/**
 * Whether the database could not be reached, as opposed to rejecting a query.
 * The marketing pages degrade to their static copy on a true, so the list has
 * to cover a refused or saturated connection too — those used to fall through
 * and take the public homepage down with a 500 whenever Neon was restarting or
 * at its connection limit.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  return /fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ECONNABORTED|EHOSTUNREACH|ENETUNREACH|EPIPE|ENOTFOUND|EAI_AGAIN|socket hang up|network|connection terminated|connect_timeout|CONNECTION_(?:CLOSED|ENDED|DESTROYED|REFUSED)|53300|57P01|57P03/i.test(
    errorChain(error),
  )
}

type SqlClient = ReturnType<typeof postgres>
const globalForDatabase = globalThis as typeof globalThis & {
  mujawibSql?: SqlClient
  mujawibSqlRealtime?: SqlClient
}

function pool(max: number): SqlClient {
  return postgres(env.DATABASE_URL, {
    max,
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 60 * 15,
    prepare: false,
  })
}

function realtimePoolMax(): number {
  const configured = Number(process.env.DATABASE_REALTIME_POOL_MAX)
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3
}

const sqlClient = globalForDatabase.mujawibSql ?? pool(5)
globalForDatabase.mujawibSql = sqlClient

/**
 * A second, small pool owned exclusively by the live call path.
 *
 * One shared pool of five connections used to serve everything at once: every
 * server-rendered console and portal page, Better Auth's per-request session
 * lookup, the maintenance worker, the Test Lab — and every write a call in
 * progress makes. The console's live view alone re-renders every few seconds,
 * and each of those re-renders is roughly ten queries. A call competing with
 * that does not fail; it waits, and a caller hears the wait as the agent going
 * quiet. Separating the pools does not make any single query faster, it stops
 * page traffic from being able to delay a call at all.
 *
 * Deliberately small. The point is isolation, not headroom: three connections
 * that only calls can use beat eight that anything can take.
 */
const sqlRealtimeClient = globalForDatabase.mujawibSqlRealtime ?? pool(realtimePoolMax())
globalForDatabase.mujawibSqlRealtime = sqlRealtimeClient

export const db = drizzle(sqlClient, { schema })

/** Use from the voice runtime only — see the note above. */
export const dbRealtime = drizzle(sqlRealtimeClient, { schema })

export type PoolName = 'app' | 'realtime'

/**
 * How long it currently takes to get a connection out of a pool.
 *
 * The audit could not tell whether the pool or the CPU was the first
 * bottleneck, because nothing measured either. `reserve()` goes through the
 * same queue a query does, so the time it takes to hand one back is the
 * queueing delay every query is already paying — the single most useful number
 * for deciding whether these pools are sized correctly.
 */
export async function poolWaitMs(name: PoolName): Promise<number> {
  const client = name === 'realtime' ? sqlRealtimeClient : sqlClient
  const startedAt = Date.now()
  const reserved = await client.reserve()
  const waited = Date.now() - startedAt
  reserved.release()
  return waited
}
