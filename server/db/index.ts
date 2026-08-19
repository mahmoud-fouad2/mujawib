import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

/**
 * Importing `env` here validates the whole server environment the first time
 * anything touches the database — which is every request path. A missing or
 * malformed DATABASE_URL fails at boot naming the variable, instead of
 * surfacing as an opaque connection error on the first query.
 */
const sql = neon(env.DATABASE_URL)

export const db = drizzle({ client: sql, schema })

export type Database = typeof db
