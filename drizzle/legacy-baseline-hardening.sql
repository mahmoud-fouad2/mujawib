-- Compatibility bridge for databases created before migrations were tracked.
-- It is intentionally idempotent and runs before tracked migrations so old
-- databases with partial migration history are repaired safely.

DO $$ BEGIN
  CREATE TYPE "public"."phone_lifecycle" AS ENUM('pending', 'verifying', 'verified', 'active', 'degraded', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."tool_execution_status" AS ENUM('running', 'succeeded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'accepting' BEFORE 'ringing';

DO $$
DECLARE current_type text;
BEGIN
  SELECT udt_name INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'phone_number' AND column_name = 'sip_status';

  IF current_type IS DISTINCT FROM 'phone_lifecycle' THEN
    ALTER TABLE "phone_number" ALTER COLUMN "sip_status" DROP DEFAULT;
    UPDATE "phone_number" SET "sip_status" = 'pending' WHERE "sip_status" IS NULL OR "sip_status" NOT IN ('pending', 'verifying', 'verified', 'active', 'degraded', 'disabled');
    ALTER TABLE "phone_number" ALTER COLUMN "sip_status" TYPE "phone_lifecycle"
      USING "sip_status"::text::"phone_lifecycle";
  END IF;
END $$;
ALTER TABLE "phone_number" ALTER COLUMN "sip_status" SET DEFAULT 'pending';
ALTER TABLE "phone_number" ALTER COLUMN "sip_status" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "tool_execution" ADD COLUMN IF NOT EXISTS "status" "tool_execution_status";
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_execution' AND column_name = 'success'
  ) THEN
    UPDATE "tool_execution"
    SET "status" = CASE
      WHEN "success" = 'true' THEN 'succeeded'::"tool_execution_status"
      WHEN "success" = 'false' THEN 'failed'::"tool_execution_status"
      ELSE 'running'::"tool_execution_status"
    END
    WHERE "status" IS NULL;
    ALTER TABLE "tool_execution" DROP COLUMN "success";
  END IF;
  UPDATE "tool_execution" SET "status" = 'running' WHERE "status" IS NULL;
  ALTER TABLE "tool_execution" ALTER COLUMN "status" SET DEFAULT 'running';
  ALTER TABLE "tool_execution" ALTER COLUMN "status" SET NOT NULL;
END $$;

DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'voice_profile' AND column_name = 'is_global';
  IF current_type IS DISTINCT FROM 'boolean' THEN
    ALTER TABLE "voice_profile" ALTER COLUMN "is_global" DROP DEFAULT;
    ALTER TABLE "voice_profile" ALTER COLUMN "is_global" TYPE boolean
      USING lower(coalesce("is_global"::text, 'false')) IN ('true', 't', '1');
  END IF;
END $$;
ALTER TABLE "voice_profile" ALTER COLUMN "is_global" SET DEFAULT false;
ALTER TABLE "voice_profile" ALTER COLUMN "is_global" SET NOT NULL;

DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tool' AND column_name = 'is_universal';
  IF current_type IS DISTINCT FROM 'boolean' THEN
    ALTER TABLE "tool" ALTER COLUMN "is_universal" DROP DEFAULT;
    ALTER TABLE "tool" ALTER COLUMN "is_universal" TYPE boolean
      USING lower(coalesce("is_universal"::text, 'false')) IN ('true', 't', '1');
  END IF;
END $$;
ALTER TABLE "tool" ALTER COLUMN "is_universal" SET DEFAULT false;
ALTER TABLE "tool" ALTER COLUMN "is_universal" SET NOT NULL;

DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scenario_test' AND column_name = 'is_critical';
  IF current_type IS DISTINCT FROM 'boolean' THEN
    ALTER TABLE "scenario_test" ALTER COLUMN "is_critical" DROP DEFAULT;
    ALTER TABLE "scenario_test" ALTER COLUMN "is_critical" TYPE boolean
      USING lower(coalesce("is_critical"::text, 'false')) IN ('true', 't', '1');
  END IF;
END $$;
ALTER TABLE "scenario_test" ALTER COLUMN "is_critical" SET DEFAULT false;
ALTER TABLE "scenario_test" ALTER COLUMN "is_critical" SET NOT NULL;

DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scenario_run' AND column_name = 'passed';
  IF current_type IS DISTINCT FROM 'boolean' THEN
    ALTER TABLE "scenario_run" ALTER COLUMN "passed" TYPE boolean
      USING lower(coalesce("passed"::text, 'false')) IN ('true', 't', '1');
  END IF;
END $$;
ALTER TABLE "scenario_run" ALTER COLUMN "passed" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "webhook_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "external_call_id" text,
  "status" text DEFAULT 'processing' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "last_error" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "background_job" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "last_error" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

UPDATE "agent" a SET "live_version_id" = NULL
WHERE "live_version_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "agent_version" v WHERE v."id" = a."live_version_id");
UPDATE "phone_number" p SET "agent_id" = NULL
WHERE "agent_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "agent" a WHERE a."id" = p."agent_id");
UPDATE "agent_version" v SET "voice_profile_id" = NULL
WHERE "voice_profile_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "voice_profile" p WHERE p."id" = v."voice_profile_id");
UPDATE "agent_version" v SET "published_by_id" = NULL
WHERE "published_by_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = v."published_by_id");
UPDATE "qa_result" q SET "reviewer_id" = NULL
WHERE "reviewer_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = q."reviewer_id");
DELETE FROM "scenario_run" r WHERE NOT EXISTS (SELECT 1 FROM "agent_version" v WHERE v."id" = r."agent_version_id");
DELETE FROM "scenario_test" s WHERE NOT EXISTS (SELECT 1 FROM "agent_version" v WHERE v."id" = s."agent_version_id");

WITH ranked AS (
  SELECT v."id", row_number() OVER (
    PARTITION BY v."agent_id"
    ORDER BY CASE WHEN a."live_version_id" = v."id" THEN 0 ELSE 1 END, v."version_number" DESC
  ) AS position
  FROM "agent_version" v
  JOIN "agent" a ON a."id" = v."agent_id"
  WHERE v."status" = 'published'
)
UPDATE "agent_version" v SET "status" = 'archived', "updated_at" = now()
FROM ranked r WHERE v."id" = r."id" AND r.position > 1;

WITH duplicates AS (
  SELECT "id", row_number() OVER (PARTITION BY "external_call_id" ORDER BY "created_at", "id") AS position
  FROM "call" WHERE "external_call_id" IS NOT NULL
)
UPDATE "call" c
SET "metadata" = coalesce(c."metadata", '{}'::jsonb) || jsonb_build_object('duplicateExternalCallId', c."external_call_id"),
    "external_call_id" = NULL
FROM duplicates d WHERE c."id" = d."id" AND d.position > 1;

DO $$ BEGIN
  ALTER TABLE "agent" ADD CONSTRAINT "agent_live_version_id_agent_version_id_fk"
    FOREIGN KEY ("live_version_id") REFERENCES "agent_version"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_voice_profile_id_voice_profile_id_fk"
    FOREIGN KEY ("voice_profile_id") REFERENCES "voice_profile"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_published_by_id_user_id_fk"
    FOREIGN KEY ("published_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "phone_number" ADD CONSTRAINT "phone_number_agent_id_agent_id_fk"
    FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "qa_result" ADD CONSTRAINT "qa_result_reviewer_id_user_id_fk"
    FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "scenario_test" ADD CONSTRAINT "scenario_test_agent_version_id_agent_version_id_fk"
    FOREIGN KEY ("agent_version_id") REFERENCES "agent_version"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_agent_version_id_agent_version_id_fk"
    FOREIGN KEY ("agent_version_id") REFERENCES "agent_version"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP INDEX IF EXISTS "call_external_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "call_external_unique_idx" ON "call" ("external_call_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_version_one_published_idx" ON "agent_version" ("agent_id") WHERE "status" = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS "background_job_dedupe_idx" ON "background_job" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "background_job_ready_idx" ON "background_job" ("status", "available_at");
CREATE INDEX IF NOT EXISTS "webhook_receipt_call_idx" ON "webhook_receipt" ("external_call_id");
CREATE INDEX IF NOT EXISTS "webhook_receipt_status_idx" ON "webhook_receipt" ("status", "updated_at");
