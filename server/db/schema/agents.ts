import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
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
import { user } from './auth-schema'
import { voiceProfile } from './voice'
import { workspace } from './workspaces'

export const agentVersionStatusEnum = pgEnum('agent_version_status', [
  'draft',
  'review',
  'published',
  'archived',
])

export const agent = pgTable(
  'agent',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    templateId: text('template_id'),
    liveVersionId: text('live_version_id').references((): AnyPgColumn => agentVersion.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_workspace_idx').on(t.workspaceId)],
)

export const agentVersion = pgTable(
  'agent_version',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: agentVersionStatusEnum('status').notNull().default('draft'),
    identity: jsonb('identity').$type<Record<string, unknown>>().default({}),
    voiceProfileId: text('voice_profile_id').references(() => voiceProfile.id, {
      onDelete: 'set null',
    }),
    businessRules: jsonb('business_rules').$type<Record<string, unknown>>().default({}),
    flows: jsonb('flows').$type<unknown[]>().default([]),
    toolBindings: jsonb('tool_bindings').$type<unknown[]>().default([]),
    routing: jsonb('routing').$type<Record<string, unknown>>().default({}),
    /**
     * A caller cancelling their own booking by phone is a distinct capability
     * from every other tool: those confirm something the caller is asking
     * for, this ends a commitment on their calendar without asking a human
     * first. Off by default and never implied by a calendar binding alone —
     * an operator opts an agent in deliberately (Agent Editor), so shipping
     * this never silently grants a new power to an agent already live.
     */
    voiceCancellationEnabled: boolean('voice_cancellation_enabled').notNull().default(false),
    compiledPrompt: text('compiled_prompt'),
    readinessScore: integer('readiness_score').default(0),
    blockers: jsonb('blockers').$type<string[]>().default([]),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedById: text('published_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('agent_version_unique_idx').on(t.agentId, t.versionNumber),
    uniqueIndex('agent_version_one_published_idx')
      .on(t.agentId)
      .where(sql`${t.status} = 'published'`),
    index('agent_version_status_idx').on(t.agentId, t.status),
  ],
)

export const knowledgeItem = pgTable(
  'knowledge_item',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    title: text('title').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    source: text('source').default('structured'),
    embedding: text('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('knowledge_workspace_idx').on(t.workspaceId, t.category)],
)

export const flow = pgTable(
  'flow',
  {
    id: text('id').primaryKey(),
    agentVersionId: text('agent_version_id')
      .notNull()
      .references(() => agentVersion.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    goal: text('goal').notNull(),
    requiredFields: jsonb('required_fields').$type<string[]>().default([]),
    actions: jsonb('actions').$type<unknown[]>().default([]),
    fallback: jsonb('fallback').$type<Record<string, unknown>>().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('flow_version_idx').on(t.agentVersionId)],
)
