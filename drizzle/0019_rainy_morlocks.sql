ALTER TABLE "scenario_test" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "scenario_test" SET "updated_at" = "created_at";
