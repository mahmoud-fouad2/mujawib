CREATE TABLE IF NOT EXISTS "announcement" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text DEFAULT 'notice' NOT NULL,
  "severity" text DEFAULT 'info' NOT NULL,
  "audience" text DEFAULT 'everyone' NOT NULL,
  "title_ar" text NOT NULL,
  "title_en" text,
  "body_ar" text,
  "body_en" text,
  "href" text,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "is_active" boolean DEFAULT false NOT NULL,
  "dismissible" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "locale" text DEFAULT 'ar' NOT NULL,
  "title" text NOT NULL,
  "excerpt" text NOT NULL,
  "body" text NOT NULL,
  "meta_title" text,
  "meta_description" text,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "read_minutes" integer DEFAULT 1 NOT NULL,
  "author_name" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_id" text,
  CONSTRAINT "article_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "announcement" ADD CONSTRAINT "announcement_updated_by_id_user_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "article" ADD CONSTRAINT "article_updated_by_id_user_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_active_idx" ON "announcement" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_published_idx" ON "article" USING btree ("status","locale","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_category_idx" ON "article" USING btree ("category","published_at");
