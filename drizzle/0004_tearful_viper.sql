ALTER TABLE "booking" DROP CONSTRAINT "booking_call_id_call_id_fk";
--> statement-breakpoint
ALTER TABLE "lead" DROP CONSTRAINT "lead_call_id_call_id_fk";
--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "caller_number_encrypted" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "caller_number_hash" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "transcript_encrypted" text;--> statement-breakpoint
ALTER TABLE "call" ADD COLUMN "sip_metadata_encrypted" text;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "request_encrypted" text;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "result_encrypted" text;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_caller_hash_idx" ON "call" USING btree ("workspace_id","caller_number_hash");