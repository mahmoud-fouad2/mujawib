import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
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
    isGlobal: boolean('is_global').notNull().default(false),

    /**
     * Stable identity for a platform default, e.g. `sara-sa`.
     * Null for a workspace's own profile. Unique, which is what lets the
     * seeding migration re-run without creating a second copy of Sara.
     */
    personaKey: text('persona_key'),
    /** Presented gender. See providerVoice for what actually speaks. */
    gender: text('gender').$type<'male' | 'female'>(),
    language: text('language').$type<'ar' | 'en'>().notNull().default('ar'),
    /**
     * The provider voice this persona actually uses.
     *
     * Held explicitly rather than derived from the dialect, because the
     * mapping is not one-to-one: the provider offers fewer voices than the
     * platform offers personas, so several personas share one. Storing it
     * makes that visible in the console instead of implied by a lookup table,
     * and lets an operator reassign a voice after listening to it rather than
     * trusting a guess baked into code.
     */
    providerVoice: text('provider_voice').notNull().default('marin'),
    /**
     * Platform defaults cannot be deleted through the UI or the actions.
     * They are referenced by onboarding, the public demo, and any workspace
     * that duplicated one; removing a row underneath those is not an undo.
     */
    isProtected: boolean('is_protected').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('voice_profile_workspace_idx').on(t.workspaceId),
    uniqueIndex('voice_profile_persona_key_idx').on(t.personaKey),
  ],
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

export const industryTemplate = pgTable('industry_template', {
  id: text('id').primaryKey(),
  packKey: text('pack_key').notNull().unique(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  knowledgeSchema: jsonb('knowledge_schema').$type<Record<string, unknown>>().default({}),
  defaultFlows: jsonb('default_flows').$type<unknown[]>().default([]),
  defaultIntegrations: jsonb('default_integrations').$type<string[]>().default([]),
  qaSuite: jsonb('qa_suite').$type<unknown[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
