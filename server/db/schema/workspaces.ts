import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { organization } from './auth-schema'

export const workspaceTypeEnum = pgEnum('workspace_type', ['operator', 'client'])
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'discovery',
  'setup',
  'pilot',
  'live',
  'paused',
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
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('change_request_workspace_idx').on(t.workspaceId, t.status)],
)
