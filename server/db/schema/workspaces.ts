import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { organization, user } from './auth-schema'

export const workspaceTypeEnum = pgEnum('workspace_type', ['operator', 'client'])
/**
 * `archived` is the resting place for a client that has left, and the default
 * answer to "delete this client". It keeps the calls, versions and audit trail
 * intact and readable while removing the workspace from every operational
 * view. Permanent deletion stays available, but it is a separate, deliberate
 * act rather than the easy one.
 */
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'discovery',
  'setup',
  'pilot',
  'live',
  'paused',
  'archived',
])

/** Client company / tenant workspace */
export const workspace = pgTable(
  'workspace',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: workspaceTypeEnum('type').notNull().default('client'),
    status: workspaceStatusEnum('status').notNull().default('discovery'),
    industryPack: text('industry_pack'),
    timezone: text('timezone').notNull().default('Asia/Riyadh'),
    locale: text('locale').notNull().default('ar-SA'),
    businessInfo: jsonb('business_info').$type<Record<string, unknown>>().default({}),
    retentionPolicy: jsonb('retention_policy').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspace_org_slug_idx').on(t.organizationId, t.slug),
    index('workspace_status_idx').on(t.status),
  ],
)

/**
 * Application authorization boundary.
 *
 * Better Auth owns identity and sessions. This table answers the separate
 * product question: which MUJAWIB workspace may that identity operate in, and
 * with which role? Operator roles attach to the operator workspace; client
 * roles attach to exactly the client workspace they may see.
 */
export const workspaceAccess = pgTable(
  'workspace_access',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspace_access_user_workspace_idx').on(t.userId, t.workspaceId),
    index('workspace_access_workspace_role_idx').on(t.workspaceId, t.role),
  ],
)

/**
 * One-time invitation into the application authorization boundary.
 *
 * Only a SHA-256 digest of the bearer token is persisted. The raw token is
 * returned to the owner once and travels in the URL fragment, keeping it out
 * of HTTP request logs and referrer headers.
 */
export const workspaceInvitation = pgTable(
  'workspace_invitation',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    status: text('status').notNull().default('pending'),
    invitedById: text('invited_by_id').references(() => user.id, { onDelete: 'set null' }),
    acceptedById: text('accepted_by_id').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'workspace_invitation_status_check',
      sql`${t.status} in ('pending', 'accepted', 'revoked', 'expired')`,
    ),
    uniqueIndex('workspace_invitation_token_hash_idx').on(t.tokenHash),
    index('workspace_invitation_workspace_status_idx').on(t.workspaceId, t.status),
    index('workspace_invitation_email_status_idx').on(t.email, t.status),
  ],
)

export const changeRequestStatusEnum = pgEnum('change_request_status', [
  'requested',
  'in_review',
  'testing',
  'scheduled',
  'live',
  'rejected',
])

export const changeRequest = pgTable(
  'change_request',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: changeRequestStatusEnum('status').notNull().default('requested'),
    requestedById: text('requested_by_id'),
    assignedToId: text('assigned_to_id'),
    dedupeKey: text('dedupe_key'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('change_request_workspace_idx').on(t.workspaceId, t.status),
    uniqueIndex('change_request_workspace_dedupe_idx').on(t.workspaceId, t.dedupeKey),
  ],
)
