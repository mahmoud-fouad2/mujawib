ALTER TABLE "workspace" ADD COLUMN "recording_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "recording_disclosure_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "recording_jurisdiction" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "recording_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "recording_approved_by_id" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_recording_approved_by_id_user_id_fk" FOREIGN KEY ("recording_approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_recording_disclosure_mode_check" CHECK ("workspace"."recording_disclosure_mode" in ('none', 'agent_intro', 'external'));--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_recording_policy_consistency_check" CHECK (not "workspace"."recording_enabled" or ("workspace"."recording_approved_at" is not null and "workspace"."recording_disclosure_mode" <> 'none'));