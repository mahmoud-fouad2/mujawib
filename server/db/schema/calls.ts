import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { agentVersion } from './agents'
import { workspace } from './workspaces'

export const callStatusEnum = pgEnum('call_status', [
  'ringing',
  'live',
  'waiting_tool',
  'transferred',
  'completed',
  'failed',
  'abandoned',
])

export const callOutcomeEnum = pgEnum('call_outcome', [
  'resolved',
  'booking',
  'lead',
  'transfer',
  'callback',
  'unresolved',
  'failed',
])

/**
 * The lifecycle of a real PSTN number.
 *
 *   pending    — configured here, but nothing has proven the path works
 *   verifying  — a call really arrived on it, and we resolved the route
 *   verified   — a call really arrived and was answered by the agent
 *   active     — verified, and carrying calls since
 *
 * A number is never promoted because a row exists or because someone ticked a
 * box; each step is written by an actual inbound call. `verifiedAt` is the
 * evidence, and code that asks "is this number live?" must read that, not the
 * status string, which seeded rows also carry.
 */
export type PhoneLifecycle = 'pending' | 'verifying' | 'verified' | 'active'

/** What the call that proved the number looked like. */
export type PhoneVerificationEvidence = {
  /** The SIP header the dialled number was actually found in. */
  matchedHeader: string
  matchedE164: string
  /** OpenAI's id for the call leg, so the log line can be found again. */
  externalCallId: string
  callId: string
  agentVersionId: string
  observedAt: string
}

export const phoneNumber = pgTable(
  'phone_number',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    e164: text('e164').notNull().unique(),
    label: text('label'),
    agentId: text('agent_id'),
    mode: text('mode').notNull().default('all_calls'),
    transferDestination: text('transfer_destination'),
    sipStatus: text('sip_status').$type<PhoneLifecycle>().default('pending'),
    routingRules: jsonb('routing_rules').$type<Record<string, unknown>>().default({}),
    lastTestAt: timestamp('last_test_at', { withTimezone: true }),
    /** Set only by a real inbound call that the agent answered. Null = unproven. */
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verificationEvidence: jsonb('verification_evidence').$type<PhoneVerificationEvidence>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('phone_workspace_idx').on(t.workspaceId)],
)

/**
 * Where a call row came from.
 *
 * The database is seeded with a generated dataset so the console has something
 * to render during development, and those rows are indistinguishable from real
 * ones once written. They must not be counted as customer activity, so every
 * row says which it is. The default is `seed`: a row that forgets to declare
 * itself understates real traffic rather than inflating it.
 */
export type CallOrigin = 'seed' | 'live'

export const call = pgTable(
  'call',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    agentVersionId: text('agent_version_id').references(() => agentVersion.id),
    phoneNumberId: text('phone_number_id').references(() => phoneNumber.id),
    externalCallId: text('external_call_id'),
    callerNumber: text('caller_number'),
    status: callStatusEnum('status').notNull().default('ringing'),
    outcome: callOutcomeEnum('outcome'),
    intent: text('intent'),
    durationSeconds: integer('duration_seconds'),
    transcript: jsonb('transcript').$type<unknown[]>().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    origin: text('origin').$type<CallOrigin>().notNull().default('seed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('call_workspace_started_idx').on(t.workspaceId, t.startedAt),
    index('call_status_idx').on(t.workspaceId, t.status),
    index('call_external_idx').on(t.externalCallId),
    index('call_origin_idx').on(t.workspaceId, t.origin),
  ],
)

export const callEvent = pgTable(
  'call_event',
  {
    id: text('id').primaryKey(),
    callId: text('call_id')
      .notNull()
      .references(() => call.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    latencyMs: integer('latency_ms'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('call_event_call_idx').on(t.callId, t.occurredAt)],
)

export const toolExecution = pgTable(
  'tool_execution',
  {
    id: text('id').primaryKey(),
    callId: text('call_id')
      .notNull()
      .references(() => call.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    request: jsonb('request').$type<Record<string, unknown>>().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    success: text('success'),
    latencyMs: integer('latency_ms'),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tool_exec_call_idx').on(t.callId)],
)

export const booking = pgTable(
  'booking',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    callId: text('call_id').references(() => call.id),
    externalId: text('external_id'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    service: text('service'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: text('status').notNull().default('confirmed'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('booking_workspace_idx').on(t.workspaceId, t.scheduledAt)],
)

export const lead = pgTable(
  'lead',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    callId: text('call_id').references(() => call.id),
    name: text('name'),
    phone: text('phone'),
    interest: text('interest'),
    status: text('status').notNull().default('new'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_workspace_idx').on(t.workspaceId, t.createdAt)],
)
