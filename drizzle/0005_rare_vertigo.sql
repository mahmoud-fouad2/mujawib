CREATE TYPE "public"."sales_inquiry_status" AS ENUM('new', 'qualified', 'proposal', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "sales_inquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"need" text NOT NULL,
	"monthly_calls" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"status" "sales_inquiry_status" DEFAULT 'new' NOT NULL,
	"owner_id" text,
	"request_fingerprint" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_inquiry" ADD CONSTRAINT "sales_inquiry_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_inquiry_status_idx" ON "sales_inquiry" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sales_inquiry_fingerprint_idx" ON "sales_inquiry" USING btree ("request_fingerprint","created_at");