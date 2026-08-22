/**
 * Creates an identity. Workspace access is granted separately by an owner.
 *
 *   pnpm user:create <email> <password> [name]
 *
 * Public sign-up is disabled. This operator-only script uses Better Auth's
 * password hasher, then writes the identity and credential atomically.
 */
import { randomUUID } from 'node:crypto'
import { auth } from '../server/auth/index.ts'
import { db } from '../server/db/index.ts'
import { account, user } from '../server/db/schema/index.ts'

const [email, password, ...nameParts] = process.argv.slice(2)
const name = nameParts.join(' ') || (email ? email.split('@')[0] : '')

if (!email || !password) {
  console.error('Usage: pnpm user:create <email> <password> [name]')
  process.exit(1)
}

if (password.length < 10) {
  console.error('Password must be at least 10 characters (matches the auth config).')
  process.exit(1)
}

try {
  const normalizedEmail = email.trim().toLowerCase()
  const context = await auth.$context
  const passwordHash = await context.password.hash(password)
  const userId = `usr_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: name as string,
      email: normalizedEmail,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(account).values({
      id: `acc_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      accountId: userId,
      providerId: 'credential',
      issuer: 'local:credential',
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })
  })

  console.log(`✓ created ${normalizedEmail}  (id ${userId})`)
  console.log('  No workspace access was granted. An owner must assign it from /console/access.')
  console.log('  Sign in at /sign-in')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('already exists') || message.includes('USER_ALREADY_EXISTS')) {
    console.error(`✗ ${email} already has an account.`)
  } else {
    console.error('✗ could not create the account:', message)
  }
  process.exit(1)
}

process.exit(0)
