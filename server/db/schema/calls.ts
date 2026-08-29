import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agent, agentVersion } from './agents'
import { workspace } from './workspaces'

/**
 * How a call ended, from the platform's point of view.
 *
 * Only states the runtime actually writes are listed. A state nothing can
 * reach is worse than no state at all: it reads as coverage in the UI while
 * describing nothing, and the next person has to prove it is dead before they
 * can remove it.
 *
 * The distinction that matters operationally is between a call the telephony
 * path never carried and a call it carried but whose bookkeeping is
 * incomplete. `accept_failed` and `route_failed` are the former — the caller
 * heard nothing. `completed_no_transcript` is the latter — the caller had a
 * conversation and we simply do not hold a record of it. Collapsing the two
 * into `failed` is what made every real call in the console look broken.
 */
export const callStatusEnum = pgEnum('call_status', [
  'accepting',
  'ringing',
  'live',
  'waiting_tool',
  'transferred',
  'completed',
  'completed_no_transcript',
  'route_failed',
  'accept_failed',
  'failed',
  'abandoned',
])

export const callOutcomeEnum = pgEnum('call_outcome', [
  'resolved',
  'booking',
  'cancellation',
  'reschedule',
  'lead',
  'transfer',
  'callback',
  'unresolved',
  'failed',
])

export const toolExecutionStatusEnum = pgEnum('tool_execution_status', [
  'running',
  'succeeded',
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
export type PhoneLifecycle =
  | 'pending'
  | 'verifying'
  | 'verified'
  | 'active'
  | 'degraded'
  | 'disabled'

export const phoneLifecycleEnum = pgEnum('phone_lifecycle', [
  'pending',
  'verifying',
  'verified',
  'active',
  'degraded',
  'disabled',
])

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
    agentId: text('agent_id').references(() => agent.id, { onDelete: 'set null' }),
    mode: text('mode').notNull().default('all_calls'),
    transferDestination: text('transfer_destination'),
    sipStatus: phoneLifecycleEnum('sip_status').notNull().default('pending'),
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

export type CallRecordingStatus =
  | 'disabled'
  | 'capturing'
  | 'processing'
  | 'ready'
  | 'partial'
  | 'failed'

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
    /**
     * Masked at write time (`maskNumber` — app/api/voice/incoming/route.ts),
     * e.g. `+966****4567`, so this column alone is safe to read anywhere
     * without exposing the full number: a raw database read (a leaked
     * `DATABASE_URL`, a stray backup) sees only the mask. The full number
     * survives solely in `callerNumberEncrypted`, decrypted back only where
     * the live call path genuinely needs it (server/voice/sideband.ts).
     * `callerNumberHash` is a deterministic HMAC of the same number, used to
     * correlate a call back to a `customer` row (server/data/crm.ts's
     * `liveCallCountsByPhone`) without ever comparing against the mask
     * directly — a masked value can never equal a customer's full phone, so
     * that correlation would otherwise silently return nothing.
     */
    callerNumber: text('caller_number'),
    callerNumberEncrypted: text('caller_number_encrypted'),
    callerNumberHash: text('caller_number_hash'),
    status: callStatusEnum('status').notNull().default('ringing'),
    outcome: callOutcomeEnum('outcome'),
    intent: text('intent'),
    durationSeconds: integer('duration_seconds'),
    // Real per-call totals from OpenAI's own usage event — not split into
    // audio/text, because the Realtime API does not report that breakdown for
    // this model. A prior version stored a made-up 40/60 split under
    // audio_tokens/text_tokens; nothing had been written to those columns
    // yet, so renaming was safe rather than migrating fabricated data.
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    // The physical name predates the recording pipeline. It stores a private
    // object key, never a public or presigned URL; media is only served by an
    // authenticated MUJAWIB route.
    recordingObjectKey: text('recording_url'),
    recordingStatus: text('recording_status')
      .$type<CallRecordingStatus>()
      .notNull()
      .default('disabled'),
    recordingContentType: text('recording_content_type'),
    recordingByteSize: integer('recording_byte_size'),
    recordingSha256: text('recording_sha256'),
    recordingFailureCode: text('recording_failure_code'),
    recordingCompletedAt: timestamp('recording_completed_at', { withTimezone: true }),
    transcript: jsonb('transcript').$type<unknown[]>().default([]),
    transcriptEncrypted: text('transcript_encrypted'),
    sipMetadataEncrypted: text('sip_metadata_encrypted'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    origin: text('origin').$type<CallOrigin>().notNull().default('seed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('call_workspace_started_idx').on(t.workspaceId, t.startedAt),
    index('call_status_idx').on(t.workspaceId, t.status),
    uniqueIndex('call_external_unique_idx').on(t.externalCallId),
    index('call_origin_idx').on(t.workspaceId, t.origin),
    index('call_caller_hash_idx').on(t.workspaceId, t.callerNumberHash),
    index('call_recording_status_idx').on(t.workspaceId, t.recordingStatus),
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
    payloadEncrypted: text('payload_encrypted'),
    latencyMs: integer('latency_ms'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('call_event_call_idx').on(t.callId, t.occurredAt)],
)

export const webhookReceipt = pgTable(
  'webhook_receipt',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    externalCallId: text('external_call_id'),
    status: text('status').notNull().default('processing'),
    attemptCount: integer('attempt_count').notNull().default(1),
    lastError: text('last_error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_receipt_call_idx').on(t.externalCallId),
    index('webhook_receipt_status_idx').on(t.status, t.updatedAt),
  ],
)

export const backgroundJob = pgTable(
  'background_job',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('background_job_dedupe_idx').on(t.dedupeKey),
    index('background_job_ready_idx').on(t.status, t.availableAt),
  ],
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
    requestEncrypted: text('request_encrypted'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    resultEncrypted: text('result_encrypted'),
    status: toolExecutionStatusEnum('status').notNull().default('running'),
    latencyMs: integer('latency_ms'),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tool_exec_call_idx').on(t.callId)],
)

/**
 * Marks one availability token as spent the moment a booking actually
 * proceeds on it — server/voice/handlers.ts's own toolExecution idempotency
 * (keyed on the Realtime tool-call id) does not cover this: a retried tool
 * call gets a fresh id, so it would sail straight past that check with the
 * same token. `id` is the token's own HMAC signature, already unique and
 * deterministic per token, so no extra hashing is needed to key on it.
 *
 * No separate cleanup: a token is only ever 10 minutes valid, so once its
 * owning call is old enough to be purged by the retention sweep
 * (server/security/retention.ts), the cascade takes this with it.
 */
export const consumedAvailabilityToken = pgTable('consumed_availability_token', {
  id: text('id').primaryKey(),
  callId: text('call_id')
    .notNull()
    .references(() => call.id, { onDelete: 'cascade' }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const booking = pgTable(
  'booking',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    callId: text('call_id').references(() => call.id, { onDelete: 'set null' }),
    externalId: text('external_id'),
    /**
     * Encrypted twins added alongside the existing plain columns, not in
     * place of them — `customerPhone` is a live join key (`getCrmCustomers`
     * correlates it against `customer.phone`), so replacing it with a masked
     * or encrypted value would silently break that correlation.
     *
     * Unlike `call.callerNumber` (masked at write time, so its own encrypted
     * twin genuinely protects against a raw database read — see the note on
     * that column), these sit as full plaintext right beside their encrypted
     * twin. Despite the name, they do not currently close the "no encryption
     * at rest" gap for a database-level read (a leaked `DATABASE_URL`, a
     * stray backup): that read exposes the plaintext column regardless, and
     * nothing in the codebase reads `customerNameEncrypted`/
     * `customerPhoneEncrypted` back yet either. Closing this for real means
     * the same mask-plus-hash-join treatment `callerNumber` already has —
     * migrating `customerPhone` itself to a hashed join key everywhere it is
     * currently correlated against in full — which needs a decision about
     * what operators actually see, since they rely on the full number today
     * to call a customer back, not only a schema change.
     */
    customerName: text('customer_name'),
    customerNameEncrypted: text('customer_name_encrypted'),
    customerPhone: text('customer_phone'),
    customerPhoneEncrypted: text('customer_phone_encrypted'),
    service: text('service'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: text('status').notNull().default('confirmed'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('booking_workspace_idx').on(t.workspaceId, t.scheduledAt),
    index('booking_call_idx').on(t.callId),
    uniqueIndex('booking_workspace_external_idx').on(t.workspaceId, t.externalId),
  ],
)

export const lead = pgTable(
  'lead',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    callId: text('call_id').references(() => call.id, { onDelete: 'set null' }),
    /**
     * Same gap as `booking.customerPhone` (see the note there) — full
     * plaintext sits beside its own encrypted twin, so a raw database read
     * exposes the same value either way, and nothing reads
     * `nameEncrypted`/`phoneEncrypted` back yet. Unlike `booking`, nothing in
     * the codebase currently joins against `lead.phone`, so masking it here
     * would not break a correlation the way it would for `booking` — but an
     * operator following up on a lead still needs the real number, so this
     * is deferred for the same reason: what operators see needs a decision,
     * not just a schema change.
     */
    name: text('name'),
    nameEncrypted: text('name_encrypted'),
    phone: text('phone'),
    phoneEncrypted: text('phone_encrypted'),
    interest: text('interest'),
    status: text('status').notNull().default('new'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lead_workspace_idx').on(t.workspaceId, t.createdAt),
    index('lead_call_idx').on(t.callId),
  ],
)
