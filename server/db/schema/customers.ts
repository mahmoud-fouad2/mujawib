import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'
import { workspace } from './workspaces'

/** A record's own lifecycle inside the CRM — deliberately three states, not a pipeline. */
export const crmCustomerStatusEnum = pgEnum('crm_customer_status', ['lead', 'active', 'inactive'])

/**
 * Caller identity aggregated across calls — Bible §20 "Customers" — and, when
 * `workspace.crmEnabled`, the client's own CRM record for that same contact.
 * There is one row per phone number per workspace either way; the CRM adds
 * columns to it rather than forking a second table, so a contact created by
 * hand and one surfaced by a real booking are the same record once matched.
 *
 * `source` says which came first: `call` rows are written by the voice path
 * the moment it captures a name and phone together (a booking or a callback
 * request — never a bare, unidentified call); `manual` rows are created by a
 * client from the CRM screen. Either can acquire the other's data later (a
 * manually-added contact who then calls in keeps their id and gains
 * `lastCallAt`), so the field is provenance, not a permanent category.
 *
 * Structured knowledge lives in `knowledgeItem` (schema/agents.ts) — this
 * table is about a person, not the business's own services or policies.
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
    email: text('email'),
    status: crmCustomerStatusEnum('status').notNull().default('lead'),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().default([]),
    source: text('source').$type<'call' | 'manual'>().notNull().default('manual'),
    lastCallAt: timestamp('last_call_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_workspace_phone_idx').on(t.workspaceId, t.phone),
    index('customer_workspace_status_idx').on(t.workspaceId, t.status),
    index('customer_workspace_created_idx').on(t.workspaceId, t.createdAt),
    // getPortalCustomers (server/data/portal.ts) orders this exact scope by
    // lastCallAt — the workspace+createdAt index above doesn't cover that sort.
    index('customer_workspace_last_call_idx').on(t.workspaceId, t.lastCallAt),
  ],
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
