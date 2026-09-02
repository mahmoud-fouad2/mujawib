-- Number-ownership verification for the public demo, and the platform's own
-- permanent blocklist.
--
-- Idempotent: runs in the Render build against a live database with no shell
-- available to repair a half-applied migration.

ALTER TABLE "demo_call_request" ADD COLUMN IF NOT EXISTS "code_hash" text;--> statement-breakpoint
ALTER TABLE "demo_call_request" ADD COLUMN IF NOT EXISTS "code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demo_call_request" ADD COLUMN IF NOT EXISTS "code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_call_request" ADD COLUMN IF NOT EXISTS "code_sent_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_call_request" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "demo_block" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" text DEFAULT 'phone' NOT NULL,
  "value" text NOT NULL,
  "reason" text,
  "created_by_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "demo_block" ADD CONSTRAINT "demo_block_created_by_id_user_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "demo_block_unique_idx" ON "demo_block" ("scope","value");--> statement-breakpoint

-- Rows created before verification existed were placed by an operator by hand
-- and were never auto-callable; leaving them on 'new' keeps that true.
CREATE INDEX IF NOT EXISTS "demo_call_request_verified_idx" ON "demo_call_request" ("status","verified_at");
