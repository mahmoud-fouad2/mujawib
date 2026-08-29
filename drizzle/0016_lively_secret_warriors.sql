CREATE TABLE "consumed_availability_token" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumed_availability_token" ADD CONSTRAINT "consumed_availability_token_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;