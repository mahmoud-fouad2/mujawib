-- Platform default voice assistants.
--
-- Seeded by migration rather than a script: this deployment has no shell, so
-- anything that needs a manual command after deploy would never run. Keyed on
-- persona_key with ON CONFLICT DO NOTHING, so re-running the migration set on
-- a fresh environment is safe and an operator's later edits to a persona are
-- never overwritten.
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "persona_key" text;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "gender" text;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "provider_voice" text DEFAULT 'marin' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "is_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voice_profile_persona_key_idx" ON "voice_profile" USING btree ("persona_key");--> statement-breakpoint
INSERT INTO "voice_profile" (
  "id", "workspace_id", "name", "country", "dialect", "style",
  "language_policy", "pacing", "is_global",
  "persona_key", "gender", "language", "provider_voice", "is_protected", "sort_order",
  "created_at", "updated_at"
) VALUES
  ('voice_sara_sa', NULL, 'سارة — السعودية', 'SA', 'saudi', 'warm', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.5,"prefixPaddingMs":240,"silenceDurationMs":560,"idleTimeoutMs":7000,"bargeIn":true}'::jsonb, true, 'sara-sa', 'female', 'ar', 'marin', true, 10, now(), now()),
  ('voice_nasser_sa', NULL, 'ناصر — السعودي', 'SA', 'saudi', 'professional', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.5,"prefixPaddingMs":240,"silenceDurationMs":560,"idleTimeoutMs":7000,"bargeIn":true}'::jsonb, true, 'nasser-sa', 'male', 'ar', 'cedar', true, 20, now(), now()),
  ('voice_lina_gulf', NULL, 'لينا — الخليجية', 'AE', 'gulf', 'concise', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.48,"prefixPaddingMs":220,"silenceDurationMs":480,"idleTimeoutMs":6500,"bargeIn":true}'::jsonb, true, 'lina-gulf', 'female', 'ar', 'marin', true, 30, now(), now()),
  ('voice_rashed_gulf', NULL, 'راشد — الخليجي', 'AE', 'gulf', 'concise', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.48,"prefixPaddingMs":220,"silenceDurationMs":480,"idleTimeoutMs":6500,"bargeIn":true}'::jsonb, true, 'rashed-gulf', 'male', 'ar', 'cedar', true, 40, now(), now()),
  ('voice_maryam_eg', NULL, 'مريم — المصرية', 'EG', 'egyptian', 'warm', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.48,"prefixPaddingMs":220,"silenceDurationMs":480,"idleTimeoutMs":6500,"bargeIn":true}'::jsonb, true, 'maryam-eg', 'female', 'ar', 'marin', true, 50, now(), now()),
  ('voice_omar_eg', NULL, 'عمر — المصري', 'EG', 'egyptian', 'professional', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.48,"prefixPaddingMs":220,"silenceDurationMs":480,"idleTimeoutMs":6500,"bargeIn":true}'::jsonb, true, 'omar-eg', 'male', 'ar', 'cedar', true, 60, now(), now()),
  ('voice_nadine_lb', NULL, 'نادين — اللبنانية', 'LB', 'lebanese', 'premium', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.5,"prefixPaddingMs":240,"silenceDurationMs":560,"idleTimeoutMs":7000,"bargeIn":true}'::jsonb, true, 'nadine-lb', 'female', 'ar', 'marin', true, 70, now(), now()),
  ('voice_karim_lb', NULL, 'كريم — اللبناني', 'LB', 'lebanese', 'premium', '{"primary":"ar","switchToEnglish":"on_caller_request","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.5,"prefixPaddingMs":240,"silenceDurationMs":560,"idleTimeoutMs":7000,"bargeIn":true}'::jsonb, true, 'karim-lb', 'male', 'ar', 'cedar', true, 80, now(), now()),
  ('voice_emma_en', NULL, 'Emma — English', 'SA', 'msa', 'professional', '{"primary":"en","switchToEnglish":"always","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.48,"prefixPaddingMs":220,"silenceDurationMs":480,"idleTimeoutMs":6500,"bargeIn":true}'::jsonb, true, 'emma-en', 'female', 'en', 'marin', true, 90, now(), now()),
  ('voice_adam_en', NULL, 'Adam — English', 'SA', 'msa', 'professional', '{"primary":"en","switchToEnglish":"always","brandNames":"keep_latin"}'::jsonb, '{"responseLength":"short","vadThreshold":0.5,"prefixPaddingMs":240,"silenceDurationMs":560,"idleTimeoutMs":7000,"bargeIn":true}'::jsonb, true, 'adam-en', 'male', 'en', 'cedar', true, 100, now(), now())
ON CONFLICT ("persona_key") DO NOTHING;
--> statement-breakpoint
-- The six personas seeded by 0023 are superseded by the ten above, which carry
-- names, gender, an explicit provider voice and deletion protection.
--
-- They are demoted rather than deleted: an agent version may already reference
-- one through voice_profile_id, and removing the row would break that version's
-- resolution at call time. Clearing is_global takes them out of the picker
-- while leaving every existing reference intact.
UPDATE "voice_profile"
SET "is_global" = false, "updated_at" = now()
WHERE "id" IN (
  'voice_global_formal_msa',
  'voice_global_natural_warm',
  'voice_global_saudi_clear',
  'voice_global_gulf_concise',
  'voice_global_lebanese_premium',
  'voice_global_egyptian_warm'
)
AND "persona_key" IS NULL;
