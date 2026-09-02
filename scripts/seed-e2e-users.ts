/**
 * Creates the two disposable identities the end-to-end suite signs in as.
 *
 *   pnpm e2e:seed
 *
 * Why this exists: the suite could never run. It needs an operator and a
 * client account, and this product requires two-factor before either console
 * opens — so `auth.setup.ts` was throwing "use an account with 2FA already
 * enrolled", which nobody could satisfy by hand without also handing the suite
 * a TOTP secret. This creates both accounts, grants them access, enrols
 * two-factor with a secret it prints, and stops.
 *
 * It touches nothing that already exists. Accounts are namespaced under
 * `e2e-*@mujawib.test` — a reserved TLD that can never receive mail — and an
 * existing one is reused rather than recreated, so running this twice is safe
 * and never rotates a password out from under a saved session.
 *
 * The client account is granted `client_admin` on whichever client workspace
 * is alphabetically first, because the suite asserts what a client can see,
 * not which client they are.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { symmetricEncrypt } from 'better-auth/crypto'
import { and, eq } from 'drizzle-orm'
import { env } from '../lib/env.ts'
import { auth } from '../server/auth/index.ts'
import { db } from '../server/db/index.ts'
import { account, twoFactor, user, workspace, workspaceAccess } from '../server/db/schema/index.ts'

/** Base32, because that is what every authenticator and Better Auth expect. */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32Secret(bytes = 20): string {
  const raw = randomBytes(bytes)
  let out = ''
  for (const byte of raw) out += BASE32[byte % 32]
  return out
}

function password(): string {
  // Long and random: these are throwaway credentials that will sit in a shell
  // profile, so their only defence is that nobody can guess them.
  return `${randomBytes(18).toString('base64url')}Aa1!`
}

type Seeded = {
  role: 'operator' | 'client'
  email: string
  password: string | null
  totpSecret: string
  workspace: string
}

async function ensureUser(email: string, name: string) {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  if (existing) return { id: existing.id, password: null }

  const secret = password()
  const context = await auth.$context
  const hash = await context.password.hash(secret)
  const id = `usr_${randomUUID().replaceAll('-', '').slice(0, 20)}`
  const now = new Date()

  await db.insert(user).values({
    id,
    email,
    name,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(account).values({
    id: `acc_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    userId: id,
    accountId: id,
    providerId: 'credential',
    // Matches `scripts/create-user.ts`; the unique index is (issuer, accountId).
    issuer: 'local:credential',
    password: hash,
    createdAt: now,
    updatedAt: now,
  })
  return { id, password: secret }
}

/**
 * Enrols two-factor with a secret we keep, so the suite can compute the code
 * the server will ask for. Re-enrols every run: a secret nobody has written
 * down is no use to a test, and these accounts exist only for tests.
 */
async function enrolTwoFactor(userId: string): Promise<string> {
  const secret = base32Secret()
  const encrypted = await symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data: secret })
  const backup = await symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data: '[]' })

  await db.delete(twoFactor).where(eq(twoFactor.userId, userId))
  await db.insert(twoFactor).values({
    id: `tfa_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    userId,
    secret: encrypted,
    backupCodes: backup,
    verified: true,
  })
  await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, userId))
  return secret
}

async function grant(userId: string, workspaceId: string, role: string) {
  const [existing] = await db
    .select({ id: workspaceAccess.id })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspaceId, workspaceId)))
    .limit(1)
  if (existing) {
    await db.update(workspaceAccess).set({ role }).where(eq(workspaceAccess.id, existing.id))
    return
  }
  await db.insert(workspaceAccess).values({
    id: `wsa_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    userId,
    workspaceId,
    role,
    createdAt: new Date(),
  })
}

const [operatorWorkspace] = await db
  .select({ id: workspace.id, name: workspace.name })
  .from(workspace)
  .where(eq(workspace.type, 'operator'))
  .limit(1)
const [clientWorkspace] = await db
  .select({ id: workspace.id, name: workspace.name })
  .from(workspace)
  .where(eq(workspace.type, 'client'))
  .orderBy(workspace.name)
  .limit(1)

if (!operatorWorkspace || !clientWorkspace) {
  console.error(
    '✗ Need one operator workspace and at least one client workspace. Run the seed first.',
  )
  process.exit(1)
}

const results: Seeded[] = []

for (const spec of [
  {
    role: 'operator' as const,
    email: 'e2e-operator@mujawib.test',
    name: 'E2E Operator',
    ws: operatorWorkspace,
    access: 'owner',
  },
  {
    role: 'client' as const,
    email: 'e2e-client@mujawib.test',
    name: 'E2E Client',
    ws: clientWorkspace,
    access: 'client_admin',
  },
]) {
  const created = await ensureUser(spec.email, spec.name)
  await grant(created.id, spec.ws.id, spec.access)
  const totpSecret = await enrolTwoFactor(created.id)
  results.push({
    role: spec.role,
    email: spec.email,
    password: created.password,
    totpSecret,
    workspace: spec.ws.name,
  })
}

console.log('')
console.log('End-to-end identities are ready.')
console.log('')
for (const seeded of results) {
  console.log(`  ${seeded.role}: ${seeded.email}  →  ${seeded.workspace}`)
  if (!seeded.password) {
    console.log('    password unchanged (account already existed)')
  }
}
console.log('')
console.log('Export these before running `pnpm e2e`:')
console.log('')
for (const seeded of results) {
  const key = seeded.role.toUpperCase()
  if (seeded.password) console.log(`MUJAWIB_E2E_${key}_EMAIL=${seeded.email}`)
  else console.log(`MUJAWIB_E2E_${key}_EMAIL=${seeded.email}`)
  if (seeded.password) console.log(`MUJAWIB_E2E_${key}_PASSWORD=${seeded.password}`)
  console.log(`MUJAWIB_E2E_${key}_TOTP=${seeded.totpSecret}`)
}
console.log('')
if (results.some((r) => !r.password)) {
  console.log('One account already existed, so its password was left alone — it is not printed')
  console.log('here and cannot be recovered. Delete the account and re-run to rotate it.')
}
process.exit(0)
