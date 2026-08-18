import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://build:build@localhost:5432/build'

const sql = neon(connectionString)

export const db = drizzle({ client: sql, schema })

export type Database = typeof db
