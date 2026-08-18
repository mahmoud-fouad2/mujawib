/**
 * Creates an operator account.
 *
 *   pnpm user:create <email> <password> [name]
 *
 * Goes through Better Auth's own sign-up API rather than inserting rows
 * directly, so the password is hashed with exactly the scheme the sign-in
 * route verifies against.
 */
import { auth } from '../server/auth/index.ts'

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
  const result = await auth.api.signUpEmail({
    body: { email, password, name: name as string },
  })
  console.log(`✓ created ${result.user.email}  (id ${result.user.id})`)
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
