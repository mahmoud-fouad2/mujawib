import { jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { workspace } from './workspaces'

/**
 * Caller identity aggregated across calls — Bible §20 "Customers".
 * Structured knowledge lives in `knowledgeItem` (schema/agents.ts).
 */
export const customer = pgTable(
  'customer',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    name: text('name'),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().default([]),
    lastCallAt: timestamp('last_call_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_workspace_phone_idx').on(t.workspaceId, t.phone)],
)
