CREATE INDEX "call_origin_started_idx" ON "call" USING btree ("origin","started_at");--> statement-breakpoint
CREATE INDEX "customer_workspace_last_call_idx" ON "customer" USING btree ("workspace_id","last_call_at");--> statement-breakpoint
CREATE INDEX "change_request_workspace_created_idx" ON "change_request" USING btree ("workspace_id","created_at");