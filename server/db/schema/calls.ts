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
    sipStatus: text('sip_status').default('pending'),
    routingRules: jsonb('routing_rules').$type<Record<string, unknown>>().default({}),
    lastTestAt: timestamp('last_test_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('phone_workspace_idx').on(t.workspaceId)],
)

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
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('call_workspace_started_idx').on(t.workspaceId, t.startedAt),
    index('call_status_idx').on(t.workspaceId, t.status),
    index('call_external_idx').on(t.externalCallId),
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
