import { sql } from 'drizzle-orm'

/** Postgres.js serializes Date values in column predicates, but raw SQL
 * fragments need an explicit scalar. Keep the conversion in one boundary. */
export function sqlTimestamp(value: Date) {
  return sql`${value.toISOString()}::timestamptz`
}
