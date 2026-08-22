CREATE TYPE "public"."agent_version_status" AS ENUM('draft', 'review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('resolved', 'booking', 'lead', 'transfer', 'callback', 'unresolved', 'failed');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('accepting', 'ringing', 'live', 'waiting_tool', 'transferred', 'completed', 'failed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."phone_lifecycle" AS ENUM('pending', 'verifying', 'verified', 'active', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."tool_execution_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_health" AS ENUM('connected', 'degraded', 'failed', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."pronunciation_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('requested', 'in_review', 'testing', 'scheduled', 'live', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('discovery', 'setup', 'pilot', 'live', 'paused');--> statement-breakpoint
CREATE TYPE "public"."workspace_type" AS ENUM('operator', 'client');--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"live_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_version" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" "agent_version_status" DEFAULT 'draft' NOT NULL,
	"identity" jsonb DEFAULT '{}'::jsonb,
	"voice_profile_id" text,
	"business_rules" jsonb DEFAULT '{}'::jsonb,
	"flows" jsonb DEFAULT '[]'::jsonb,
	"tool_bindings" jsonb DEFAULT '[]'::jsonb,
	"routing" jsonb DEFAULT '{}'::jsonb,
	"compiled_prompt" text,
	"readiness_score" integer DEFAULT 0,
	"blockers" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp with time zone,
	"published_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_version_id" text NOT NULL,
	"name" text NOT NULL,
	"goal" text NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"fallback" jsonb DEFAULT '{}'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_item" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"source" text DEFAULT 'structured',
	"embedding" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "background_job" (
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
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"call_id" text,
	"external_id" text,
	"customer_name" text,
	"customer_phone" text,
	"service" text,
	"scheduled_at" timestamp with time zone,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_version_id" text,
	"phone_number_id" text,
	"external_call_id" text,
	"caller_number" text,
	"status" "call_status" DEFAULT 'ringing' NOT NULL,
	"outcome" "call_outcome",
	"intent" text,
	"duration_seconds" integer,
	"transcript" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"origin" text DEFAULT 'seed' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_event" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"latency_ms" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"call_id" text,
	"name" text,
	"phone" text,
	"interest" text,
	"status" text DEFAULT 'new' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_number" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"e164" text NOT NULL,
	"label" text,
	"agent_id" text,
	"mode" text DEFAULT 'all_calls' NOT NULL,
	"transfer_destination" text,
	"sip_status" "phone_lifecycle" DEFAULT 'pending' NOT NULL,
	"routing_rules" jsonb DEFAULT '{}'::jsonb,
	"last_test_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verification_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_number_e164_unique" UNIQUE("e164")
);
--> statement-breakpoint
CREATE TABLE "tool_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"request" jsonb DEFAULT '{}'::jsonb,
	"result" jsonb,
	"status" "tool_execution_status" DEFAULT 'running' NOT NULL,
	"latency_ms" integer,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_receipt" (
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
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"last_call_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"health" "integration_health" DEFAULT 'disconnected' NOT NULL,
	"credentials_ref" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"error_rate_24h" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"name" text NOT NULL,
	"action" text NOT NULL,
	"category" text NOT NULL,
	"schema" jsonb DEFAULT '{}'::jsonb,
	"integration_id" text,
	"is_universal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"recipient_user_id" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"href" text,
	"source_type" text,
	"source_id" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_severity_check" CHECK ("notification"."severity" in ('info', 'success', 'warning', 'critical')),
	CONSTRAINT "notification_category_check" CHECK ("notification"."category" in ('call', 'integration', 'qa', 'change_request', 'system', 'access'))
);
--> statement-breakpoint
CREATE TABLE "qa_result" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"reviewer_id" text,
	"score" integer,
	"flags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_run" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_version_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_test" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_version_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb,
	"expected_outcome" jsonb DEFAULT '{}'::jsonb,
	"is_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_template" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_key" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"knowledge_schema" jsonb DEFAULT '{}'::jsonb,
	"default_flows" jsonb DEFAULT '[]'::jsonb,
	"default_integrations" jsonb DEFAULT '[]'::jsonb,
	"qa_suite" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "industry_template_pack_key_unique" UNIQUE("pack_key")
);
--> statement-breakpoint
CREATE TABLE "pronunciation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"canonical" text NOT NULL,
	"arabic_display" text,
	"spoken_hint" text NOT NULL,
	"category" text DEFAULT 'brand' NOT NULL,
	"scope" text DEFAULT 'client' NOT NULL,
	"status" "pronunciation_status" DEFAULT 'draft' NOT NULL,
	"last_issue_call_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"dialect" text NOT NULL,
	"style" text DEFAULT 'professional' NOT NULL,
	"language_policy" jsonb DEFAULT '{}'::jsonb,
	"pacing" jsonb DEFAULT '{}'::jsonb,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_request" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "change_request_status" DEFAULT 'requested' NOT NULL,
	"requested_by_id" text,
	"assigned_to_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "workspace_type" DEFAULT 'client' NOT NULL,
	"status" "workspace_status" DEFAULT 'discovery' NOT NULL,
	"industry_pack" text,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"locale" text DEFAULT 'ar-SA' NOT NULL,
	"business_info" jsonb DEFAULT '{}'::jsonb,
	"retention_policy" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_access" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_id" text,
	"accepted_by_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitation_status_check" CHECK ("workspace_invitation"."status" in ('pending', 'accepted', 'revoked', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_live_version_id_agent_version_id_fk" FOREIGN KEY ("live_version_id") REFERENCES "public"."agent_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_voice_profile_id_voice_profile_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow" ADD CONSTRAINT "flow_agent_version_id_agent_version_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_item" ADD CONSTRAINT "knowledge_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_agent_version_id_agent_version_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_phone_number_id_phone_number_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_number"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_event" ADD CONSTRAINT "call_event_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_number" ADD CONSTRAINT "phone_number_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_number" ADD CONSTRAINT "phone_number_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD CONSTRAINT "tool_execution_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool" ADD CONSTRAINT "tool_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool" ADD CONSTRAINT "tool_integration_id_integration_connection_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration_connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_result" ADD CONSTRAINT "qa_result_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_result" ADD CONSTRAINT "qa_result_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_agent_version_id_agent_version_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_scenario_id_scenario_test_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenario_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_test" ADD CONSTRAINT "scenario_test_agent_version_id_agent_version_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation" ADD CONSTRAINT "pronunciation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profile" ADD CONSTRAINT "voice_profile_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_accepted_by_id_user_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_workspace_idx" ON "agent" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_version_unique_idx" ON "agent_version" USING btree ("agent_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_version_one_published_idx" ON "agent_version" USING btree ("agent_id") WHERE "agent_version"."status" = 'published';--> statement-breakpoint
CREATE INDEX "agent_version_status_idx" ON "agent_version" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "flow_version_idx" ON "flow" USING btree ("agent_version_id");--> statement-breakpoint
CREATE INDEX "knowledge_workspace_idx" ON "knowledge_item" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_org_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "background_job_dedupe_idx" ON "background_job" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "background_job_ready_idx" ON "background_job" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "booking_workspace_idx" ON "booking" USING btree ("workspace_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "call_workspace_started_idx" ON "call" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "call_status_idx" ON "call" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "call_external_unique_idx" ON "call" USING btree ("external_call_id");--> statement-breakpoint
CREATE INDEX "call_origin_idx" ON "call" USING btree ("workspace_id","origin");--> statement-breakpoint
CREATE INDEX "call_event_call_idx" ON "call_event" USING btree ("call_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lead_workspace_idx" ON "lead" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "phone_workspace_idx" ON "phone_number" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tool_exec_call_idx" ON "tool_execution" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "webhook_receipt_call_idx" ON "webhook_receipt" USING btree ("external_call_id");--> statement-breakpoint
CREATE INDEX "webhook_receipt_status_idx" ON "webhook_receipt" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_workspace_phone_idx" ON "customer" USING btree ("workspace_id","phone");--> statement-breakpoint
CREATE INDEX "audit_workspace_idx" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_workspace_idx" ON "integration_connection" USING btree ("workspace_id","health");--> statement-breakpoint
CREATE INDEX "tool_workspace_idx" ON "tool" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipient_dedupe_idx" ON "notification" USING btree ("recipient_user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_recipient_read_created_idx" ON "notification" USING btree ("recipient_user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notification_workspace_category_created_idx" ON "notification" USING btree ("workspace_id","category","created_at");--> statement-breakpoint
CREATE INDEX "qa_call_idx" ON "qa_result" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "scenario_run_version_idx" ON "scenario_run" USING btree ("agent_version_id","ran_at");--> statement-breakpoint
CREATE INDEX "scenario_agent_version_idx" ON "scenario_test" USING btree ("agent_version_id");--> statement-breakpoint
CREATE INDEX "pronunciation_workspace_idx" ON "pronunciation" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "voice_profile_workspace_idx" ON "voice_profile" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "change_request_workspace_idx" ON "change_request" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_org_slug_idx" ON "workspace" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "workspace_status_idx" ON "workspace" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_access_user_workspace_idx" ON "workspace_access" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_access_workspace_role_idx" ON "workspace_access" USING btree ("workspace_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_token_hash_idx" ON "workspace_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "workspace_invitation_workspace_status_idx" ON "workspace_invitation" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_invitation_email_status_idx" ON "workspace_invitation" USING btree ("email","status");