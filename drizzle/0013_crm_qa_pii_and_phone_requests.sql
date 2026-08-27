CREATE TYPE "public"."crm_customer_status" AS ENUM('lead', 'active', 'inactive');--> statement-breakpoint
DROP INDEX "qa_call_idx";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "customer_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "customer_phone_encrypted" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "name_encrypted" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "phone_encrypted" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "status" "crm_customer_status" DEFAULT 'lead' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "crm_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_workspace_status_idx" ON "customer" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "customer_workspace_created_idx" ON "customer" USING btree ("workspace_id","created_at");--> statement-breakpoint
-- Defensive: the new unique index below assumes at most one qa_result row per
-- call_id. Seed data never produces a duplicate, but production state can't be
-- inspected from here, so any pre-existing duplicate is resolved by keeping
-- the newest row before the constraint is added — mirrors the same
-- dedupe-before-constraint pattern already used in legacy-baseline-hardening.sql.
DELETE FROM "qa_result" a USING "qa_result" b
  WHERE a."call_id" = b."call_id"
    AND (a."created_at" < b."created_at" OR (a."created_at" = b."created_at" AND a."id" < b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX "qa_call_unique_idx" ON "qa_result" USING btree ("call_id");