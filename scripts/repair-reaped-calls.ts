/**
 * One-off repair for calls the stale-call reaper mislabelled.
 *
 *   corepack pnpm calls:repair-reaped
 *
 * Before the reaper was corrected it closed every call still marked `live`
 * after four hours as `failed`, with `durationSeconds = now - startedAt`. Both
 * were wrong for calls OpenAI had accepted: the caller did reach the agent,
 * and the number written was how long the row sat unclosed — which is why the
 * console showed forty-hour phone calls.
 *
 * This rewrites only rows carrying that exact signature: closed at the same
 * instant the sweep ran, no transcript, no outcome, and a duration longer than
 * any real call. It never touches a row a sideband closed properly, and it
 * never invents a duration to replace the one it clears.
 *
 * Safe to re-run: the second run matches nothing.
 */
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const sql = postgres(databaseUrl, { max: 1, prepare: false })

/** No inbound support call runs for four hours. Anything longer is the bug. */
const IMPOSSIBLE_DURATION_SECONDS = 4 * 60 * 60

try {
  const candidates = await sql`
    select id, external_call_id, status, duration_seconds, started_at
    from call
    where status = 'failed'
      and outcome is null
      and duration_seconds > ${IMPOSSIBLE_DURATION_SECONDS}
      and coalesce(jsonb_array_length(transcript), 0) = 0
      and transcript_encrypted is null
      and external_call_id is not null
    order by started_at
  `

  if (candidates.length === 0) {
    console.log('No mislabelled calls found — nothing to repair.')
  } else {
    console.log(`Repairing ${candidates.length} call(s) closed by the old reaper:\n`)
    for (const row of candidates) {
      const hours = (Number(row.duration_seconds) / 3600).toFixed(1)
      console.log(`  ${row.id}  ${row.external_call_id}  was: failed / ${hours}h`)
    }

    const repaired = await sql`
      update call
         set status = 'completed_no_transcript',
             duration_seconds = null
       where id in ${sql(candidates.map((row) => row.id as string))}
      returning id
    `
    console.log(`\n✓ ${repaired.length} call(s) → completed_no_transcript, duration cleared.`)
    console.log('  The calls were answered; only our record of them is incomplete.')
  }
} finally {
  await sql.end({ timeout: 5 })
}
