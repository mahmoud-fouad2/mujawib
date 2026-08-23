/**
 * Inspect and recover two-factor authentication for one account.
 *
 *   pnpm 2fa:status <email>   what the server sees, and the code it expects now
 *   pnpm 2fa:unlock <email>   clear the failed-attempt lock without losing the enrolment
 *   pnpm 2fa:reset  <email>   remove the enrolment so the account can sign in and re-enrol
 *
 * Why this exists: an operator account is required to carry two-factor before
 * the console opens, so a broken enrolment locks the owner out of the product
 * with no route back through the browser. `status` separates the three causes
 * that all surface as "wrong code":
 *
 *   1. BETTER_AUTH_SECRET changed since enrolment — the stored secret no longer
 *      decrypts, so no code can ever match. Only `reset` fixes this.
 *   2. Clock drift — the code is right but the counter is not. Compare the
 *      printed code with the authenticator app.
 *   3. Lockout — ten consecutive failures freeze the account for 15 minutes.
 */
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { symmetricDecrypt } from 'better-auth/crypto'
import { env } from '../lib/env.ts'
import { db } from '../server/db/index.ts'
import { twoFactor, user } from '../server/db/schema/index.ts'

const COMMANDS = ['status', 'unlock', 'reset'] as const
type Command = (typeof COMMANDS)[number]

const [rawCommand, rawEmail] = process.argv.slice(2)
const command = rawCommand as Command
const email = rawEmail?.trim().toLowerCase()

if (!COMMANDS.includes(command) || !email) {
  console.error(`Usage: pnpm 2fa:<${COMMANDS.join('|')}> <email>`)
  process.exit(1)
}

/**
 * The same code Better Auth compares against: HMAC-SHA1 over the 30-second
 * counter, keyed by the UTF-8 bytes of the decrypted secret, truncated to six
 * digits (RFC 6238).
 */
function totp(secret: string, offsetSteps = 0): string {
  const counter = Math.floor(Date.now() / 30_000) + offsetSteps
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', Buffer.from(secret, 'utf8')).update(message).digest()
  const offset = (digest[digest.length - 1] as number) & 0x0f
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

const [account] = await db
  .select({
    id: user.id,
    email: user.email,
    name: user.name,
    twoFactorEnabled: user.twoFactorEnabled,
  })
  .from(user)
  .where(eq(user.email, email))
  .limit(1)

if (!account) {
  console.error(`✗ No account exists for ${email}.`)
  process.exit(1)
}

const [enrolment] = await db
  .select()
  .from(twoFactor)
  .where(eq(twoFactor.userId, account.id))
  .limit(1)

if (command === 'status') {
  console.log(`account            ${account.email}  (${account.name || 'no name'})`)
  console.log(`twoFactorEnabled   ${account.twoFactorEnabled ? 'yes' : 'no'}`)
  console.log(`server time        ${new Date().toISOString()}`)

  if (!enrolment) {
    console.log('enrolment          none stored')
    console.log('')
    console.log(
      account.twoFactorEnabled
        ? 'Inconsistent: the account demands a code but no secret is stored. Run 2fa:reset.'
        : 'Sign in with the password alone, then enrol at /account/security.',
    )
    process.exit(0)
  }

  const locked = enrolment.lockedUntil && enrolment.lockedUntil.getTime() > Date.now()
  console.log(`verified           ${enrolment.verified ? 'yes' : 'no — setup was never completed'}`)
  console.log(`failed attempts    ${enrolment.failedVerificationCount ?? 0} (locks at 10)`)
  console.log(
    `locked until       ${locked ? enrolment.lockedUntil?.toISOString() : 'not locked'}`,
  )

  let secret: string | null = null
  try {
    secret = await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: enrolment.secret })
  } catch {
    secret = null
  }

  if (!secret) {
    console.log('stored secret      CANNOT BE DECRYPTED with this BETTER_AUTH_SECRET')
    console.log('')
    console.log('This is the cause: the signing secret changed after enrolment, so every')
    console.log('code fails no matter which app generated it. Run 2fa:reset and enrol again.')
    process.exit(0)
  }

  console.log('stored secret      decrypts correctly')
  console.log('')
  console.log(`expected code now  ${totp(secret)}   (previous ${totp(secret, -1)}, next ${totp(secret, 1)})`)
  console.log('')
  console.log('If the authenticator app shows one of these, the enrolment is sound and the')
  console.log('failure is the lock or an expired challenge — run 2fa:unlock and sign in again.')
  console.log('If it shows something else, the phone clock has drifted, or the app holds an')
  console.log('older enrolment: run 2fa:reset and scan the new code.')
  process.exit(0)
}

if (!enrolment && command === 'unlock') {
  console.log(`Nothing to unlock — ${account.email} has no stored enrolment.`)
  process.exit(0)
}

if (command === 'unlock') {
  await db
    .update(twoFactor)
    .set({ failedVerificationCount: 0, lockedUntil: null })
    .where(eq(twoFactor.userId, account.id))
  console.log(`✓ Cleared the failed-attempt lock for ${account.email}.`)
  console.log('  The enrolment is untouched — sign in again with the authenticator code.')
  process.exit(0)
}

await db.transaction(async (tx) => {
  await tx.delete(twoFactor).where(eq(twoFactor.userId, account.id))
  await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, account.id))
})

console.log(`✓ Removed two-factor from ${account.email}.`)
console.log('  Sign in with the email and password alone, then enrol again at')
console.log('  /account/security — the console requires it before it opens.')
console.log('  Store the backup codes shown during setup: they are the route back next time.')
process.exit(0)
