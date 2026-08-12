import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { call } from './calls'

export const qaResult = pgTable(
  'qa_result',
  {
    id: text('id').primaryKey(),
    callId: text('call_id')
      .notNull()
      .references(() => call.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id'),
    score: integer('score'),
    flags: jsonb('flags').$type<string[]>().default([]),
    notes: text('notes'),
    action: text('action'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('qa_call_idx').on(t.callId)],
)

export const scenarioTest = pgTable(
  'scenario_test',
  {
    id: text('id').primaryKey(),
    agentVersionId: text('agent_version_id').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().default({}),
    expectedOutcome: jsonb('expected_outcome').$type<Record<string, unknown>>().default({}),
    isCritical: text('is_critical').default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scenario_agent_version_idx').on(t.agentVersionId)],
)

export const scenarioRun = pgTable(
  'scenario_run',
  {
    id: text('id').primaryKey(),
    agentVersionId: text('agent_version_id').notNull(),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarioTest.id, { onDelete: 'cascade' }),
    passed: text('passed').notNull(),
    score: integer('score'),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scenario_run_version_idx').on(t.agentVersionId, t.ranAt)],
)
