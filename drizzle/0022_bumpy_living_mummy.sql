CREATE TYPE "public"."site_event_type" AS ENUM('page_view', 'cta_click');--> statement-breakpoint
CREATE TABLE "site_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "site_event_type" NOT NULL,
	"path" text NOT NULL,
	"cta_id" text,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_event_type_created_idx" ON "site_event" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "site_event_path_idx" ON "site_event" USING btree ("path");