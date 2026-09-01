-- The sideband recovery sweep (server/voice/sideband.ts) and the post-call
-- drain (server/calls/intelligence.ts) both filter background_job on `type`
-- before anything else, and both run on every fifteen-second maintenance
-- tick. Neither existing index starts with that column, so each sweep was a
-- full scan of a table that grows by one row per call.
CREATE INDEX IF NOT EXISTS "background_job_type_status_idx"
  ON "background_job" USING btree ("type", "status", "available_at");
