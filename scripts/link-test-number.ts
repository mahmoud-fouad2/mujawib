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
import { neon } from '@neondatabase/serverless'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../server/db/schema/index.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const db = drizzle({ client: neon(connectionString), schema })

/* ─── the one route we are configuring ───────────────────────────────────── */

const DID_E164 = '+18574444576'
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

  const agent = agents.find((a) => a.name === AGENT_NAME) ?? agents[0]
  if (!agent) {
    console.error(`✗ client "${ws.name}" has no agent.`)
    process.exit(1)
  }
  console.log(`· agent    ${agent.name}  (${agent.id})`)

  // ── published, tool-less version ───────────────────────────────────────
  // Tools cannot execute until the sideband is deployed, so this first version
  // is conversation-only: an empty toolBindings array yields no tools at all.
  const versions = await db
    .select()
    .from(schema.agentVersion)
    .where(eq(schema.agentVersion.agentId, agent.id))

  const published = versions.find((v) => v.status === 'published')
  let versionId: string
  let versionNumber: number

  if (published) {
    versionId = published.id
    versionNumber = published.versionNumber
    await db
      .update(schema.agentVersion)
      .set({ toolBindings: [], blockers: [], updatedAt: now })
      .where(eq(schema.agentVersion.id, versionId))
    console.log(`· version  v${versionNumber} (existing, tools cleared for milestone 1)`)
  } else {
    versionNumber = Math.max(0, ...versions.map((v) => v.versionNumber)) + 1
    versionId = id('av')
    await db.insert(schema.agentVersion).values({
      id: versionId,
      agentId: agent.id,
      versionNumber,
      status: 'published',
      identity: {
        role: `موظف استقبال صوتي لدى ${ws.name}`,
        goals: ['الترحيب بالمتصل', 'الإجابة عن الأسئلة من المعرفة المسجّلة'],
        restricted: ['لا يؤكد أي حجز أو تعديل — لا يملك أدوات بعد'],
      },
      voiceProfileId: versions[0]?.voiceProfileId ?? null,
      businessRules: (versions[0]?.businessRules ?? {}) as Record<string, unknown>,
      flows: [],
      toolBindings: [],
      routing: { afterHours: 'callback' },
      readinessScore: 100,
      blockers: [],
      publishedAt: now,
      publishedById: 'voice-milestone-1',
      createdAt: now,
      updatedAt: now,
    })
    console.log(`· version  v${versionNumber} (created, published, no tools)`)
  }

  await db
    .update(schema.agent)
    .set({ liveVersionId: versionId, updatedAt: now })
    .where(eq(schema.agent.id, agent.id))

  // ── phone route ────────────────────────────────────────────────────────
  const [existing] = await db
    .select()
    .from(schema.phoneNumber)
    .where(eq(schema.phoneNumber.e164, DID_E164))
    .limit(1)

  if (existing) {
    await db
      .update(schema.phoneNumber)
      .set({
        workspaceId: ws.id,
        agentId: agent.id,
        label: 'DID اختبار المكالمة الأولى',
        mode: 'all_calls',
        sipStatus: 'pending',
        updatedAt: now,
      })
      .where(eq(schema.phoneNumber.id, existing.id))
    console.log(`· number   ${DID_E164} (updated → ${ws.name} / ${agent.name})`)
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

  if (!check) {
    console.error('\n✗ route did NOT verify — the webhook would reject this call.')
    process.exit(1)
  }

  console.log(
    `\n✓ ${DID_E164} → ${ws.name} → ${check.agentName} v${versionNumber} (published, 0 tools)`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
