ALTER TABLE "call_event" ADD COLUMN "payload_encrypted" text;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD COLUMN "credentials_encrypted" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "monthly_call_limit" integer DEFAULT 10000;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "concurrent_call_limit" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
CREATE INDEX "booking_call_idx" ON "booking" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "lead_call_idx" ON "lead" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_monthly_call_limit_check" CHECK ("workspace"."monthly_call_limit" is null or "workspace"."monthly_call_limit" > 0);--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_concurrent_call_limit_check" CHECK ("workspace"."concurrent_call_limit" > 0);