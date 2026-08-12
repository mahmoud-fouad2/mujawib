import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { workspace } from './workspaces'

export const integrationHealthEnum = pgEnum('integration_health', [
  'connected',
  'degraded',
  'failed',
  'disconnected',
])

export const integrationConnection = pgTable(
  'integration_connection',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    label: text('label').notNull(),
    health: integrationHealthEnum('health').notNull().default('disconnected'),
    credentialsRef: text('credentials_ref'),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    errorRate24h: text('error_rate_24h'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('integration_workspace_idx').on(t.workspaceId, t.health)],
)

export const tool = pgTable(
  'tool',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    action: text('action').notNull(),
    category: text('category').notNull(),
    schema: jsonb('schema').$type<Record<string, unknown>>().default({}),
    integrationId: text('integration_id').references(() => integrationConnection.id),
    isUniversal: text('is_universal').default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tool_workspace_idx').on(t.workspaceId)],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'set null' }),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_workspace_idx').on(t.workspaceId, t.createdAt)],
)
