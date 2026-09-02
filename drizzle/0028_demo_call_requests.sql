-- A visitor asking to be called by the assistant.
--
-- Idempotent for the same reason 0027 is: this runs in the Render build
-- against a live database, with no shell available to repair a half-applied
-- migration.

CREATE TABLE IF NOT EXISTS "demo_call_request" (
  "id" text PRIMARY KEY NOT NULL,
  "phone" text NOT NULL,
  "country_code" text NOT NULL,
  "name" text,
  "business_name" text,
  "persona_key" text,
  "locale" text DEFAULT 'ar' NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "call_id" text,
  "note" text,
  "consent_at" timestamp with time zone NOT NULL,
  "request_fingerprint" text NOT NULL,
  "handled_by_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "demo_call_request" ADD CONSTRAINT "demo_call_request_call_id_call_id_fk"
    FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "demo_call_request" ADD CONSTRAINT "demo_call_request_handled_by_id_user_id_fk"
    FOREIGN KEY ("handled_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "demo_call_request_status_idx" ON "demo_call_request" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_call_request_phone_idx" ON "demo_call_request" ("phone","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_call_request_fingerprint_idx" ON "demo_call_request" ("request_fingerprint","created_at");
