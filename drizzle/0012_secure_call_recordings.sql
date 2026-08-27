ALTER TABLE "call" ADD COLUMN "recording_status" text DEFAULT 'disabled' NOT NULL;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "recording_content_type" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "recording_byte_size" integer;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "recording_sha256" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "recording_failure_code" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "recording_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "call_recording_status_idx" ON "call" USING btree ("workspace_id","recording_status");