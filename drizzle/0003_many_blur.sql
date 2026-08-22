ALTER TABLE "change_request" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_workspace_external_idx" ON "booking" USING btree ("workspace_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "change_request_workspace_dedupe_idx" ON "change_request" USING btree ("workspace_id","dedupe_key");