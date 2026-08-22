export const OPERATOR_ROLES = ['owner', 'ops', 'qa', 'integrator'] as const
export const CLIENT_ROLES = [
  'client_admin',
  'client_manager',
  'client_reviewer',
  'client_read_only',
] as const
const ACCESS_ROLES = [...OPERATOR_ROLES, ...CLIENT_ROLES] as const

export type OperatorRole = (typeof OPERATOR_ROLES)[number]
export type ClientRole = (typeof CLIENT_ROLES)[number]
export type AccessRole = (typeof ACCESS_ROLES)[number]

export type OperatorPermission =
  | 'console.view'
  | 'client.manage'
  | 'agent.publish'
  | 'test.manage'
  | 'qa.review'
  | 'voice.manage'
  | 'integration.manage'
  | 'phone.manage'
  | 'system.view'
  | 'change.manage'
  | 'access.manage'

export type ClientPermission =
  | 'portal.view'
  | 'request.create'
  | 'request.cancel'
  | 'business.manage'

export const ACCESS_ROLE_LABEL: Record<AccessRole, string> = {
  owner: 'مالك المنصة',
  ops: 'تشغيل',
  qa: 'جودة',
  integrator: 'ربط تقني',
  client_admin: 'مدير العميل',
  client_manager: 'مدير عمليات',
  client_reviewer: 'مراجع',
  client_read_only: 'قراءة فقط',
}

const OPERATOR_POLICY: Record<OperatorRole, ReadonlySet<OperatorPermission>> = {
  owner: new Set([
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
  ]),
  ops: new Set([
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
  ]),
  qa: new Set(['console.view', 'qa.review', 'test.manage', 'voice.manage', 'change.manage']),
  integrator: new Set(['console.view', 'integration.manage', 'phone.manage', 'system.view']),
}

const CLIENT_POLICY: Record<ClientRole, ReadonlySet<ClientPermission>> = {
  client_admin: new Set(['portal.view', 'request.create', 'request.cancel', 'business.manage']),
  client_manager: new Set(['portal.view', 'request.create', 'request.cancel', 'business.manage']),
  client_reviewer: new Set(['portal.view', 'request.create']),
  client_read_only: new Set(['portal.view']),
}

export function isOperatorRole(value: string): value is OperatorRole {
  return (OPERATOR_ROLES as readonly string[]).includes(value)
}

export function isClientRole(value: string): value is ClientRole {
  return (CLIENT_ROLES as readonly string[]).includes(value)
}

export function canOperator(role: string, permission: OperatorPermission): boolean {
  return isOperatorRole(role) && OPERATOR_POLICY[role].has(permission)
}

export function canClient(role: string, permission: ClientPermission): boolean {
  return isClientRole(role) && CLIENT_POLICY[role].has(permission)
}
