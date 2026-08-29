import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MANAGED_AUTH_POLICY, resolveAuthDestination } from '../lib/auth-policy.ts'

const readProjectFile = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

assert.equal(MANAGED_AUTH_POLICY.publicEmailSignUp, false)
assert.equal(MANAGED_AUTH_POLICY.publicSocialSignUp, false)

assert.equal(
  resolveAuthDestination({ requested: null, hasOperatorAccess: true, hasPortalAccess: false }),
  '/console',
)
assert.equal(
  resolveAuthDestination({ requested: null, hasOperatorAccess: false, hasPortalAccess: true }),
  '/portal',
)
assert.equal(
  resolveAuthDestination({
    requested: '/console/clients',
    hasOperatorAccess: false,
    hasPortalAccess: true,
  }),
  '/portal',
)
assert.equal(
  resolveAuthDestination({
    requested: '/portal/calls',
    hasOperatorAccess: true,
    hasPortalAccess: false,
  }),
  '/console',
)
assert.equal(
  resolveAuthDestination({ requested: null, hasOperatorAccess: false, hasPortalAccess: false }),
  '/access-pending',
)
assert.equal(
  resolveAuthDestination({
    requested: '/invite',
    hasOperatorAccess: false,
    hasPortalAccess: false,
  }),
  '/invite',
)

const accountSchema = readProjectFile('server/db/schema/auth-schema.ts')
const authConfig = readProjectFile('server/auth/index.ts')
const migration = readProjectFile('drizzle/0006_sticky_colonel_america.sql')
const createUser = readProjectFile('scripts/create-user.ts')
const accessActions = readProjectFile('server/actions/access.ts')
const accessGuards = readProjectFile('server/auth/access.ts')

assert.match(accountSchema, /issuer:\s*text\('issuer'\)\.notNull\(\)/)
assert.match(accountSchema, /uniqueIndex\('account_issuer_account_id_uidx'\)/)
assert.match(createUser, /issuer:\s*'local:credential'/)
assert.match(accessActions, /issuer:\s*'local:credential'/)
assert.match(migration, /SET "issuer" = 'local:credential', "account_id" = "user_id"/)
assert.match(migration, /SET "issuer" = 'https:\/\/accounts\.google\.com'/)
assert.match(migration, /Account issuer backfill found duplicate identities/)
assert.match(migration, /ALTER COLUMN "issuer" SET NOT NULL/)
assert.match(authConfig, /ipAddressHeaders:\s*\['cf-connecting-ip'\]/)

// The Portal has the same page-level and action-level 2FA gate the Console
// already had — a compromised portal password alone must not be enough for
// access to a client's own customer data.
assert.match(accessGuards, /redirect\('\/account\/security\?required=portal'\)/)
assert.match(
  accessGuards,
  /authorizeClientWorkspace[\s\S]*?if \(!fields\.twoFactorEnabled\) return null/,
)

console.log('Managed authentication contract verified.')
