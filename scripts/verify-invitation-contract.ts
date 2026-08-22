import assert from 'node:assert/strict'
import {
  isInvitationOpen,
  maskInvitationEmail,
  normalizeInvitationEmail,
  roleFitsWorkspace,
} from '../lib/invitations.ts'
import {
  buildInvitationUrl,
  createInvitationToken,
  hashInvitationToken,
} from '../server/auth/invitations.ts'

const first = createInvitationToken()
const second = createInvitationToken()

assert.notEqual(first.raw, second.raw, 'Invitation tokens must be unique')
assert.equal(
  first.hash,
  hashInvitationToken(first.raw),
  'The persisted digest must be reproducible',
)
assert.notEqual(first.raw, first.hash, 'The raw bearer token must never be persisted as its digest')
assert.match(first.hash, /^[a-f0-9]{64}$/, 'Invitation digest must be SHA-256 hex')

const url = new URL(buildInvitationUrl('https://app.mujawib.ai', first.raw))
assert.equal(url.pathname, '/invite')
assert.equal(url.search, '', 'Bearer tokens must not appear in the query string')
assert.equal(url.hash, `#token=${first.raw}`, 'Bearer token must travel in the URL fragment')
assert.equal(url.toString().includes(`?token=${first.raw}`), false)

assert.equal(normalizeInvitationEmail('  Owner@Example.COM '), 'owner@example.com')
assert.equal(maskInvitationEmail('owner@example.com'), 'ow***@example.com')
assert.equal(roleFitsWorkspace('owner', 'operator'), true)
assert.equal(roleFitsWorkspace('client_admin', 'client'), true)
assert.equal(roleFitsWorkspace('owner', 'client'), false)
assert.equal(roleFitsWorkspace('client_admin', 'operator'), false)

const now = new Date('2026-08-20T12:00:00.000Z')
assert.equal(isInvitationOpen('pending', new Date('2026-08-20T12:01:00.000Z'), now), true)
assert.equal(isInvitationOpen('accepted', new Date('2026-08-20T12:01:00.000Z'), now), false)
assert.equal(isInvitationOpen('pending', new Date('2026-08-20T11:59:00.000Z'), now), false)

console.log('Invitation security contract verified.')
