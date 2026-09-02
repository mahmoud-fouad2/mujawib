-- Outbound campaigns.
--
-- Written by hand rather than generated so every guard is explicit: this runs
-- inside the Render build against a live database with no shell available to
-- fix a half-applied migration, so every statement is idempotent.

CREATE TABLE IF NOT EXISTS "outbound_campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "purpose" text,
  "consent_basis" text,
  "consent_note" text,
  "agent_version_id" text,
  "from_number_id" text,
  "script" text,
  "forbidden_claims" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "window_start_minute" integer DEFAULT 600 NOT NULL,
  "window_end_minute" integer DEFAULT 1080 NOT NULL,
  "window_days" jsonb DEFAULT '[0,1,2,3,4]'::jsonb NOT NULL,
  "utc_offset_minutes" integer DEFAULT 180 NOT NULL,
  "initial_concurrency" integer DEFAULT 1 NOT NULL,
  "max_concurrency" integer DEFAULT 3 NOT NULL,
  "ramp_minutes" integer DEFAULT 10 NOT NULL,
  "daily_cap" integer DEFAULT 100 NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_dispatch_reason" text,
  "last_dispatch_at" timestamp with time zone,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "approved_by_id" text,
  "review_note" text,
  "created_by_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "campaign_contact" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "phone" text NOT NULL,
  "name" text,
  "note" text,
  "fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "last_error" text,
  "last_call_id" text,
  "outcome" text,
  "summary" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "suppression_entry" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "phone" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "reason" text,
  "created_by_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "campaign_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "masked_phone" text NOT NULL,
  "contact_id" text,
  "call_id" text,
  "placed" boolean DEFAULT false NOT NULL,
  "outcome" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "outbound_campaign" ADD CONSTRAINT "outbound_campaign_workspace_id_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_campaign" ADD CONSTRAINT "outbound_campaign_agent_version_id_agent_version_id_fk"
    FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_version"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_campaign" ADD CONSTRAINT "outbound_campaign_from_number_id_phone_number_id_fk"
    FOREIGN KEY ("from_number_id") REFERENCES "public"."phone_number"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_campaign" ADD CONSTRAINT "outbound_campaign_approved_by_id_user_id_fk"
    FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_campaign" ADD CONSTRAINT "outbound_campaign_created_by_id_user_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "campaign_contact" ADD CONSTRAINT "campaign_contact_campaign_id_outbound_campaign_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "public"."outbound_campaign"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_contact" ADD CONSTRAINT "campaign_contact_workspace_id_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_contact" ADD CONSTRAINT "campaign_contact_last_call_id_call_id_fk"
    FOREIGN KEY ("last_call_id") REFERENCES "public"."call"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "suppression_entry" ADD CONSTRAINT "suppression_entry_workspace_id_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "suppression_entry" ADD CONSTRAINT "suppression_entry_created_by_id_user_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "campaign_attempt" ADD CONSTRAINT "campaign_attempt_campaign_id_outbound_campaign_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "public"."outbound_campaign"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_attempt" ADD CONSTRAINT "campaign_attempt_workspace_id_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_attempt" ADD CONSTRAINT "campaign_attempt_call_id_call_id_fk"
    FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "outbound_campaign_workspace_idx" ON "outbound_campaign" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_campaign_status_idx" ON "outbound_campaign" ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_campaign_created_idx" ON "outbound_campaign" ("workspace_id","created_at");--> statement-breakpoint

-- One row per number per campaign. Re-uploading the same file must not double
-- every contact, and one person must not be called twice for a single run.
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_contact_unique_idx" ON "campaign_contact" ("campaign_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_contact_dispatch_idx" ON "campaign_contact" ("campaign_id","status","last_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_contact_workspace_phone_idx" ON "campaign_contact" ("workspace_id","phone");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "suppression_entry_unique_idx" ON "suppression_entry" ("workspace_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppression_entry_workspace_idx" ON "suppression_entry" ("workspace_id","created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "campaign_attempt_campaign_idx" ON "campaign_attempt" ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_attempt_workspace_idx" ON "campaign_attempt" ("workspace_id","created_at");
