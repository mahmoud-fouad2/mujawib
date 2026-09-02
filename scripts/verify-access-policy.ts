import { canClient, canOperator, isClientRole, isOperatorRole } from '../lib/access.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) console.log(`      expected ${String(expected)}; got ${String(actual)}`)
}

console.log('Role boundaries')
check('owner is an operator role', isOperatorRole('owner'), true)
check('client admin is not an operator role', isOperatorRole('client_admin'), false)
check('read-only is a client role', isClientRole('client_read_only'), true)
check('unknown roles are rejected', isClientRole('member'), false)

console.log('\nOperator permissions')
check('owner manages access', canOperator('owner', 'access.manage'), true)
check('ops cannot manage access', canOperator('ops', 'access.manage'), false)
check('QA can review calls', canOperator('qa', 'qa.review'), true)
check('QA can run release tests', canOperator('qa', 'test.manage'), true)
check('QA cannot publish agents', canOperator('qa', 'agent.publish'), false)
check('integrator manages integrations', canOperator('integrator', 'integration.manage'), true)
check('integrator can inspect system health', canOperator('integrator', 'system.view'), true)
check('integrator cannot edit clients', canOperator('integrator', 'client.manage'), false)
check('integrator cannot run release tests', canOperator('integrator', 'test.manage'), false)
check('QA cannot inspect integration health', canOperator('qa', 'system.view'), false)
check('client role cannot enter console', canOperator('client_admin', 'console.view'), false)

console.log('\nClient permissions')
check('client admin edits business info', canClient('client_admin', 'business.manage'), true)
check('client manager may cancel requests', canClient('client_manager', 'request.cancel'), true)
check('reviewer may submit a request', canClient('client_reviewer', 'request.create'), true)
check(
  'reviewer cannot change business info',
  canClient('client_reviewer', 'business.manage'),
  false,
)
check('read-only cannot submit requests', canClient('client_read_only', 'request.create'), false)
check(
  'read-only cannot listen to recordings',
  canClient('client_read_only', 'recording.listen'),
  false,
)
check(
  'client manager can listen to recordings',
  canClient('client_manager', 'recording.listen'),
  true,
)
check('client manager may cancel bookings', canClient('client_manager', 'booking.manage'), true)
check('reviewer cannot cancel bookings', canClient('client_reviewer', 'booking.manage'), false)
check('operator role cannot enter client portal', canClient('owner', 'portal.view'), false)

// Outbound campaigns. The whole safety model is this split: a client may
// build and submit a campaign, and only an operator may approve it. If these
// two ever drift, a client can make a phone ring on their own say-so.
console.log('\nOutbound campaigns')
check('client admin may build a campaign', canClient('client_admin', 'campaign.manage'), true)
check('client manager may build a campaign', canClient('client_manager', 'campaign.manage'), true)
check('reviewer may not build a campaign', canClient('client_reviewer', 'campaign.manage'), false)
check('read-only may not build a campaign', canClient('client_read_only', 'campaign.manage'), false)
check('owner approves campaigns', canOperator('owner', 'campaign.approve'), true)
check('ops approves campaigns', canOperator('ops', 'campaign.approve'), true)
check('QA cannot approve campaigns', canOperator('qa', 'campaign.approve'), false)
check('integrator cannot approve campaigns', canOperator('integrator', 'campaign.approve'), false)
check(
  'no client role can approve a campaign',
  ['client_admin', 'client_manager', 'client_reviewer', 'client_read_only'].some((role) =>
    canOperator(role, 'campaign.approve'),
  ),
  false,
)

if (failures > 0) {
  console.error(`\n${failures} access policy check(s) failed.`)
  process.exit(1)
}

console.log('\nAll access policy checks passed.')
