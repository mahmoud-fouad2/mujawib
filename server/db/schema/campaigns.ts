import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agentVersion } from './agents'
import { user } from './auth-schema'
import { call, phoneNumber } from './calls'
import { workspace } from './workspaces'

/**
 * Outbound campaigns.
 *
 * Every other table in this product records something a caller chose to do.
 * This one records something we intend to do to people who have not asked,
 * which is why it carries a legal basis, an approval, a suppression list and
 * an audit trail before it carries a single feature.
 *
 * Three tables, and the split matters:
 *
 * `outbound_campaign` is the intent and the rules — who, from what number,
 * saying what, inside which hours, at what pace, approved by whom.
 *
 * `campaign_contact` is one row per person, with its own attempt count and
 * its own status. Attempt limits belong here rather than on the campaign
 * because the thing being protected is a person, not a batch.
 *
 * `suppression_entry` is the do-not-call list, keyed on the workspace and the
 * number. It is checked at queue time and again immediately before the dial:
 * a number can land on it after its row was already queued, and the queue
 * must never be the thing that decides.
 */

export type CampaignStatusValue =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'running'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'rejected'

export type CampaignPurposeValue = 'followup' | 'reminder' | 'survey' | 'announcement' | 'sales'
export type ConsentBasisValue = 'existing_customer' | 'explicit_optin' | 'inbound_request'

export const outboundCampaign = pgTable(
  'outbound_campaign',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    purpose: text('purpose').$type<CampaignPurposeValue>(),

    /**
     * Why this list may be called, and the operator's own note backing it up.
     * Stored on the campaign rather than derived, so it can be produced later
     * exactly as it was asserted at the time.
     */
    consentBasis: text('consent_basis').$type<ConsentBasisValue>(),
    consentNote: text('consent_note'),

    /** Who speaks, and what the recipient sees on their screen. */
    agentVersionId: text('agent_version_id').references(() => agentVersion.id, {
      onDelete: 'set null',
    }),
    fromNumberId: text('from_number_id').references(() => phoneNumber.id, { onDelete: 'set null' }),

    /** What the agent is told to do, and what it must never say. */
    script: text('script'),
    forbiddenClaims: text('forbidden_claims'),

    status: text('status').$type<CampaignStatusValue>().notNull().default('draft'),

    /* calling window, in workspace-local minutes from midnight */
    windowStartMinute: integer('window_start_minute').notNull().default(600),
    windowEndMinute: integer('window_end_minute').notNull().default(1080),
    windowDays: jsonb('window_days').$type<number[]>().notNull().default([0, 1, 2, 3, 4]),
    utcOffsetMinutes: integer('utc_offset_minutes').notNull().default(180),

    /* pacing */
    initialConcurrency: integer('initial_concurrency').notNull().default(1),
    maxConcurrency: integer('max_concurrency').notNull().default(3),
    rampMinutes: integer('ramp_minutes').notNull().default(10),
    dailyCap: integer('daily_cap').notNull().default(100),

    /** Set the first time the campaign actually starts, and never reset. */
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /**
     * Why the dispatcher last did nothing. A campaign that quietly makes no
     * progress is indistinguishable from a broken one; this is what the UI
     * reads to say "outside the calling window" instead of showing silence.
     */
    lastDispatchReason: text('last_dispatch_reason'),
    lastDispatchAt: timestamp('last_dispatch_at', { withTimezone: true }),

    /**
     * The approval gate. A client can build and submit; only an operator can
     * approve, and the approval is what unlocks `running`.
     */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedById: text('approved_by_id').references(() => user.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),

    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('outbound_campaign_workspace_idx').on(t.workspaceId, t.status),
    // The dispatcher sweeps for running campaigns across every workspace.
    index('outbound_campaign_status_idx').on(t.status, t.updatedAt),
    index('outbound_campaign_created_idx').on(t.workspaceId, t.createdAt),
  ],
)

export type CampaignContactStatusValue =
  | 'pending'
  | 'queued'
  | 'calling'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'suppressed'
  | 'cancelled'

export const campaignContact = pgTable(
  'campaign_contact',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => outboundCampaign.id, { onDelete: 'cascade' }),
    /** Denormalised so a suppression sweep can filter without a join. */
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),

    /** E.164, normalised on import. Never stored as the operator typed it. */
    phone: text('phone').notNull(),
    name: text('name'),
    note: text('note'),
    /** The rest of the uploaded columns, for personalising the call. */
    fields: jsonb('fields').$type<Record<string, string>>().notNull().default({}),

    status: text('status').$type<CampaignContactStatusValue>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastError: text('last_error'),

    /** Set only when a call row actually exists — never optimistically. */
    lastCallId: text('last_call_id').references(() => call.id, { onDelete: 'set null' }),
    outcome: text('outcome'),
    summary: text('summary'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per number per campaign: re-uploading the same file must not
    // double every contact, and a person must not be called twice for one run.
    uniqueIndex('campaign_contact_unique_idx').on(t.campaignId, t.phone),
    index('campaign_contact_dispatch_idx').on(t.campaignId, t.status, t.lastAttemptAt),
    index('campaign_contact_workspace_phone_idx').on(t.workspaceId, t.phone),
  ],
)

export type SuppressionSource = 'manual' | 'recipient_request' | 'failed_repeatedly' | 'import'

export const suppressionEntry = pgTable(
  'suppression_entry',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    source: text('source').$type<SuppressionSource>().notNull().default('manual'),
    reason: text('reason'),
    /**
     * Deliberately no expiry. A do-not-call request that lapses on its own is
     * not a do-not-call request. Removal is an explicit, audited action.
     */
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('suppression_entry_unique_idx').on(t.workspaceId, t.phone),
    index('suppression_entry_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
)

/**
 * One row per placed call attempt, kept even when the campaign row is edited.
 *
 * The campaign's own counters are a cache; this is the record. It is what
 * answers "how many times did we ring this person, and on whose approval" if
 * anyone ever asks, and it survives a contact being deleted from the list.
 */
export const campaignAttempt = pgTable(
  'campaign_attempt',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => outboundCampaign.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    /** Masked at write time, same discipline as `call.callerNumber`. */
    maskedPhone: text('masked_phone').notNull(),
    contactId: text('contact_id'),
    callId: text('call_id').references(() => call.id, { onDelete: 'set null' }),
    placed: boolean('placed').notNull().default(false),
    outcome: text('outcome'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('campaign_attempt_campaign_idx').on(t.campaignId, t.createdAt),
    index('campaign_attempt_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
)

export type DemoRequestStatus =
  | 'new'
  | 'approved'
  | 'calling'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'blocked'

/**
 * A visitor asking to be called by the assistant.
 *
 * This is the one row in the product created by somebody with no account, that
 * can end with the platform dialling a phone. So it is a request, not a
 * trigger: it is stored, rate limited, and shown to an operator, and the call
 * is placed by a person deciding to place it.
 *
 * That is not a temporary limitation waiting on a provider. A public form that
 * dials whatever number is typed into it is a harassment tool regardless of
 * how good the demo is — the number entered is very often not the number of
 * the person entering it. An operator in the loop, or verified ownership of
 * the number, is the price of the feature.
 */
export const demoCallRequest = pgTable(
  'demo_call_request',
  {
    id: text('id').primaryKey(),
    /** E.164, normalised on write. Never stored as typed. */
    phone: text('phone').notNull(),
    countryCode: text('country_code').notNull(),
    name: text('name'),
    businessName: text('business_name'),
    /** Which of the default assistants the visitor asked to hear. */
    personaKey: text('persona_key'),
    locale: text('locale').notNull().default('ar'),

    status: text('status').$type<DemoRequestStatus>().notNull().default('new'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    callId: text('call_id').references(() => call.id, { onDelete: 'set null' }),
    note: text('note'),

    /** Ticked explicitly by the visitor; the row is refused without it. */
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    /** Hashed address + number, for the repeat-submission window. */
    requestFingerprint: text('request_fingerprint').notNull(),

    handledById: text('handled_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('demo_call_request_status_idx').on(t.status, t.createdAt),
    index('demo_call_request_phone_idx').on(t.phone, t.createdAt),
    index('demo_call_request_fingerprint_idx').on(t.requestFingerprint, t.createdAt),
  ],
)
