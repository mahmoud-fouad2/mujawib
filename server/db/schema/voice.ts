import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { workspace } from './workspaces'

export const voiceProfile = pgTable(
  'voice_profile',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    country: text('country').notNull(),
    dialect: text('dialect').notNull(),
    style: text('style').notNull().default('professional'),
    languagePolicy: jsonb('language_policy').$type<Record<string, unknown>>().default({}),
    pacing: jsonb('pacing').$type<Record<string, unknown>>().default({}),
    isGlobal: text('is_global').default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('voice_profile_workspace_idx').on(t.workspaceId)],
)

export const pronunciationStatusEnum = pgEnum('pronunciation_status', [
  'draft',
  'approved',
  'rejected',
])

export const pronunciation = pgTable(
  'pronunciation',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    canonical: text('canonical').notNull(),
    arabicDisplay: text('arabic_display'),
    spokenHint: text('spoken_hint').notNull(),
    category: text('category').notNull().default('brand'),
    scope: text('scope').notNull().default('client'),
    status: pronunciationStatusEnum('status').notNull().default('draft'),
    lastIssueCallId: text('last_issue_call_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pronunciation_workspace_idx').on(t.workspaceId, t.status)],
)

export const industryTemplate = pgTable(
  'industry_template',
  {
    id: text('id').primaryKey(),
    packKey: text('pack_key').notNull().unique(),
    name: text('name').notNull(),
    version: text('version').notNull(),
    knowledgeSchema: jsonb('knowledge_schema').$type<Record<string, unknown>>().default({}),
    defaultFlows: jsonb('default_flows').$type<unknown[]>().default([]),
    defaultIntegrations: jsonb('default_integrations').$type<string[]>().default([]),
    qaSuite: jsonb('qa_suite').$type<unknown[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
)
