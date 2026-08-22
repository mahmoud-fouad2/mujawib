import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'
import { workspace } from './workspaces'

/** A private, durable notification addressed to one signed-in user. */
export const notification = pgTable(
  'notification',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    severity: text('severity').notNull().default('info'),
    category: text('category').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    href: text('href'),
    sourceType: text('source_type'),
    sourceId: text('source_id'),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'notification_severity_check',
      sql`${t.severity} in ('info', 'success', 'warning', 'critical')`,
    ),
    check(
      'notification_category_check',
      sql`${t.category} in ('call', 'integration', 'qa', 'change_request', 'system', 'access')`,
    ),
    uniqueIndex('notification_recipient_dedupe_idx').on(t.recipientUserId, t.dedupeKey),
    index('notification_recipient_read_created_idx').on(t.recipientUserId, t.readAt, t.createdAt),
    index('notification_workspace_category_created_idx').on(t.workspaceId, t.category, t.createdAt),
  ],
)
