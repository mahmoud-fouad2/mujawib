import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations')

const migrationsFolder = path.resolve('drizzle')
const client = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 10,
  prepare: false,
})

async function baselineExistingDatabase() {
  const [state] = await client<
    {
      coreExists: string | null
      historyExists: string | null
    }[]
  >`
    select
      to_regclass('public.workspace')::text as "coreExists",
      to_regclass('drizzle.__drizzle_migrations')::text as "historyExists"
  `

  if (!state?.coreExists) return

  const compatibilitySql = await readFile(
    path.join(migrationsFolder, 'legacy-baseline-hardening.sql'),
    'utf8',
  )
  await client.unsafe(compatibilitySql)

  const hasHistory = state.historyExists
    ? (
        await client<{ count: number }[]>`
        select count(*)::int as count from drizzle.__drizzle_migrations
      `
      )[0]?.count
    : 0
  if (hasHistory) return

  const journal = JSON.parse(
    await readFile(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { tag: string; when: number }[] }
  const first = journal.entries[0]
  if (!first) throw new Error('The baseline migration journal is empty')

  const migrationSql = await readFile(path.join(migrationsFolder, `${first.tag}.sql`), 'utf8')
  const hash = createHash('sha256').update(migrationSql).digest('hex')

  await client`create schema if not exists drizzle`
  await client`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `
  await client`
    insert into drizzle.__drizzle_migrations (hash, created_at)
    values (${hash}, ${first.when})
  `
}

try {
  await baselineExistingDatabase()
  await migrate(drizzle(client), { migrationsFolder })
  console.log('Database migrations are current.')
} finally {
  await client.end({ timeout: 5 })
}
