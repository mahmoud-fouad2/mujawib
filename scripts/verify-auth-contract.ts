import assert from 'node:assert/strict'
import { MANAGED_AUTH_POLICY, resolveAuthDestination } from '../lib/auth-policy.ts'

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

console.log('Managed authentication contract verified.')
