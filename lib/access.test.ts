import { describe, expect, it } from 'vitest'
import {
  CLIENT_ROLES,
  canClient,
  canOperator,
  isClientRole,
  isOperatorRole,
  OPERATOR_ROLES,
} from './access'

describe('isOperatorRole / isClientRole', () => {
  it('accepts every declared operator role and rejects client roles', () => {
    for (const role of OPERATOR_ROLES) expect(isOperatorRole(role)).toBe(true)
    for (const role of CLIENT_ROLES) expect(isOperatorRole(role)).toBe(false)
  })

  it('accepts every declared client role and rejects operator roles', () => {
    for (const role of CLIENT_ROLES) expect(isClientRole(role)).toBe(true)
    for (const role of OPERATOR_ROLES) expect(isClientRole(role)).toBe(false)
  })

  it('rejects a role string from neither list', () => {
    expect(isOperatorRole('superadmin')).toBe(false)
    expect(isClientRole('superadmin')).toBe(false)
  })
})

describe('canOperator', () => {
  it('gives the owner every operator permission', () => {
    const permissions: Parameters<typeof canOperator>[1][] = [
      'console.view',
      'client.manage',
      'agent.publish',
      'test.manage',
      'qa.review',
      'voice.manage',
      'integration.manage',
      'phone.manage',
      'system.view',
      'change.manage',
      'access.manage',
    ]
    for (const permission of permissions) expect(canOperator('owner', permission)).toBe(true)
  })

  // access.manage — granting or revoking who else can act as an operator — is
  // the one permission this test locks to the owner alone. Regressing it
  // silently would let ops/qa/integrator invite or remove operator access.
  it('reserves access.manage for the owner', () => {
    expect(canOperator('owner', 'access.manage')).toBe(true)
    expect(canOperator('ops', 'access.manage')).toBe(false)
    expect(canOperator('qa', 'access.manage')).toBe(false)
    expect(canOperator('integrator', 'access.manage')).toBe(false)
  })

  it('keeps qa scoped to review, testing, and voice — not client or phone data', () => {
    expect(canOperator('qa', 'qa.review')).toBe(true)
    expect(canOperator('qa', 'test.manage')).toBe(true)
    expect(canOperator('qa', 'voice.manage')).toBe(true)
    expect(canOperator('qa', 'client.manage')).toBe(false)
    expect(canOperator('qa', 'phone.manage')).toBe(false)
    expect(canOperator('qa', 'integration.manage')).toBe(false)
  })

  it('keeps integrator scoped to connections and telephony, not client or QA data', () => {
    expect(canOperator('integrator', 'integration.manage')).toBe(true)
    expect(canOperator('integrator', 'phone.manage')).toBe(true)
    expect(canOperator('integrator', 'system.view')).toBe(true)
    expect(canOperator('integrator', 'client.manage')).toBe(false)
    expect(canOperator('integrator', 'qa.review')).toBe(false)
    expect(canOperator('integrator', 'agent.publish')).toBe(false)
  })

  it('denies a client role entirely, whatever the permission', () => {
    expect(canOperator('client_admin', 'console.view')).toBe(false)
  })

  it('denies an unrecognised role', () => {
    expect(canOperator('nonexistent', 'console.view')).toBe(false)
  })
})

describe('canClient', () => {
  it('lets a client admin manage business data and requests', () => {
    expect(canClient('client_admin', 'portal.view')).toBe(true)
    expect(canClient('client_admin', 'request.create')).toBe(true)
    expect(canClient('client_admin', 'request.cancel')).toBe(true)
    expect(canClient('client_admin', 'business.manage')).toBe(true)
  })

  it('lets a reviewer view and request, but not manage business data', () => {
    expect(canClient('client_reviewer', 'portal.view')).toBe(true)
    expect(canClient('client_reviewer', 'request.create')).toBe(true)
    expect(canClient('client_reviewer', 'business.manage')).toBe(false)
    expect(canClient('client_reviewer', 'request.cancel')).toBe(false)
  })

  it('limits read-only to viewing the portal alone', () => {
    expect(canClient('client_read_only', 'portal.view')).toBe(true)
    expect(canClient('client_read_only', 'request.create')).toBe(false)
    expect(canClient('client_read_only', 'business.manage')).toBe(false)
  })

  it('denies an operator role entirely, whatever the permission', () => {
    expect(canClient('owner', 'portal.view')).toBe(false)
  })
})
