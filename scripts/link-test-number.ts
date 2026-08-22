/**
 * Links one PSTN DID to one explicit client and one published, tool-less
 * AgentVersion, for the first end-to-end voice call.
 *
 *   pnpm voice:link-number
 *
 * Idempotent: re-running updates the same rows rather than creating duplicates.
 *
 * Deliberately explicit — the client slug and the DID are constants here, not
 * "whichever workspace was found first". The webhook resolver has no fallback,
 * so a route that is not created here simply will not answer.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/db/schema/index.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const client = postgres(connectionString, { max: 1, prepare: false })
const db = drizzle(client, { schema })

/* ─── the one route we are configuring ───────────────────────────────────── */

const DID_E164 = '+16513711782'
const LEGACY_DID_E164 = '+18574444576'
const CLIENT_SLUG = 'alfa-clinic'
const AGENT_NAME = 'سارة'

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

async function main() {
  const now = new Date()

  // ── client ─────────────────────────────────────────────────────────────
  const [ws] = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.slug, CLIENT_SLUG))
    .limit(1)

  if (!ws) {
    console.error(`✗ no client with slug "${CLIENT_SLUG}". Run pnpm db:seed first.`)
    process.exit(1)
  }
  console.log(`· client   ${ws.name}  (${ws.id})`)

  // ── agent ──────────────────────────────────────────────────────────────
  const agents = await db.select().from(schema.agent).where(eq(schema.agent.workspaceId, ws.id))

  const agent = agents.find((candidate) => candidate.name === AGENT_NAME)
  if (!agent) {
    console.error(`✗ client "${ws.name}" has no agent named "${AGENT_NAME}".`)
    process.exit(1)
  }
  console.log(`· agent    ${agent.name}  (${agent.id})`)

  // ── explicitly selected published version ─────────────────────────────
  // A published version is immutable here: this script never changes bindings
  // or silently substitutes another published row.
  const versions = await db
    .select()
    .from(schema.agentVersion)
    .where(eq(schema.agentVersion.agentId, agent.id))

  const published = versions.find((version) => version.id === agent.liveVersionId)
  if (published?.status !== 'published') {
    console.error('✗ the explicitly selected live AgentVersion is not published.')
    process.exit(1)
  }

  const bindings = ((published.toolBindings ?? []) as unknown[]).filter(Boolean)
  const versionId = published.id
  const versionNumber = published.versionNumber
  console.log(`· version  v${versionNumber} (published, ${bindings.length} bindings, unchanged)`)

  // ── phone route ────────────────────────────────────────────────────────
  const routes = await db
    .select({ id: schema.phoneNumber.id, e164: schema.phoneNumber.e164 })
    .from(schema.phoneNumber)
    .where(inArray(schema.phoneNumber.e164, [DID_E164, LEGACY_DID_E164]))

  const existing = routes.find((route) => route.e164 === DID_E164)
  const legacy = routes.find((route) => route.e164 === LEGACY_DID_E164)

  if (existing && legacy) {
    console.error(
      '✗ both the new and legacy DID exist; refusing to choose or delete a route implicitly.',
    )
    process.exit(1)
  }

  if (existing) {
    await db
      .update(schema.phoneNumber)
      .set({
        workspaceId: ws.id,
        agentId: agent.id,
        label: 'DID اختبار المكالمة الأولى',
        mode: 'all_calls',
        updatedAt: now,
      })
      .where(eq(schema.phoneNumber.id, existing.id))
    console.log(`· number   ${DID_E164} (updated → ${ws.name} / ${agent.name})`)
  } else if (legacy) {
    await db
      .update(schema.phoneNumber)
      .set({
        e164: DID_E164,
        workspaceId: ws.id,
        agentId: agent.id,
        label: 'DID اختبار المكالمة الأولى',
        mode: 'all_calls',
        sipStatus: 'pending',
        updatedAt: now,
      })
      .where(eq(schema.phoneNumber.id, legacy.id))
    console.log(`· number   ${LEGACY_DID_E164} replaced by ${DID_E164}`)
  } else {
    await db.insert(schema.phoneNumber).values({
      id: id('phone'),
      workspaceId: ws.id,
      e164: DID_E164,
      label: 'DID اختبار المكالمة الأولى',
      agentId: agent.id,
      mode: 'all_calls',
      transferDestination: null,
      sipStatus: 'pending',
      routingRules: {},
      createdAt: now,
      updatedAt: now,
    })
    console.log(`· number   ${DID_E164} (created → ${ws.name} / ${agent.name})`)
  }

  // ── verify the resolver would find it ──────────────────────────────────
  const [check] = await db
    .select({
      e164: schema.phoneNumber.e164,
      agentName: schema.agent.name,
      live: schema.agent.liveVersionId,
    })
    .from(schema.phoneNumber)
    .innerJoin(schema.agent, eq(schema.phoneNumber.agentId, schema.agent.id))
    .innerJoin(
      schema.agentVersion,
      and(
        eq(schema.agentVersion.id, schema.agent.liveVersionId),
        eq(schema.agentVersion.status, 'published'),
      ),
    )
    .where(eq(schema.phoneNumber.e164, DID_E164))
    .limit(1)

  if (!check || check.live !== versionId) {
    console.error('\n✗ route did NOT verify — the webhook would reject this call.')
    process.exit(1)
  }

  console.log(
    `\n✓ ${DID_E164} → ${ws.name} → ${check.agentName} v${versionNumber} (published, 0 tools)`,
  )
}

main()
  .then(async () => {
    await client.end()
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    return client.end().finally(() => process.exit(1))
  })
