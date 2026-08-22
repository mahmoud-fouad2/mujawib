/** Additive notification schema installation for databases without a migration baseline. */
import { sql } from 'drizzle-orm'
import { db } from '../server/db/index.ts'

await db.execute(
  sql.raw(`
  CREATE TABLE IF NOT EXISTS "notification" (
    "id" text PRIMARY KEY NOT NULL,
    "workspace_id" text REFERENCES "workspace"("id") ON DELETE CASCADE,
    "recipient_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
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
    CONSTRAINT "notification_severity_check"
      CHECK ("severity" IN ('info', 'success', 'warning', 'critical')),
    CONSTRAINT "notification_category_check"
      CHECK ("category" IN ('call', 'integration', 'qa', 'change_request', 'system', 'access'))
  )
`),
)

await db.execute(
  sql.raw(`
  CREATE UNIQUE INDEX IF NOT EXISTS "notification_recipient_dedupe_idx"
  ON "notification" ("recipient_user_id", "dedupe_key")
`),
)

await db.execute(
  sql.raw(`
  CREATE INDEX IF NOT EXISTS "notification_recipient_read_created_idx"
  ON "notification" ("recipient_user_id", "read_at", "created_at")
`),
)

await db.execute(
  sql.raw(`
  CREATE INDEX IF NOT EXISTS "notification_workspace_category_created_idx"
  ON "notification" ("workspace_id", "category", "created_at")
`),
)

console.log('Notification schema is ready.')
