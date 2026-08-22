import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'
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

export const salesInquiryStatusEnum = pgEnum('sales_inquiry_status', [
  'new',
  'qualified',
  'proposal',
  'won',
  'lost',
])

/** A public contact request with an explicit lifecycle inside Operations. */
export const salesInquiry = pgTable(
  'sales_inquiry',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    company: text('company').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    need: text('need').notNull(),
    monthlyCalls: text('monthly_calls'),
    locale: text('locale').notNull().default('ar'),
    source: text('source').notNull().default('website'),
    status: salesInquiryStatusEnum('status').notNull().default('new'),
    ownerId: text('owner_id').references(() => user.id, { onDelete: 'set null' }),
    requestFingerprint: text('request_fingerprint').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sales_inquiry_status_idx').on(t.status, t.createdAt),
    index('sales_inquiry_fingerprint_idx').on(t.requestFingerprint, t.createdAt),
  ],
)
