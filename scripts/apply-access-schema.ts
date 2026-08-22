/**
 * Additive one-time access-control schema installation.
 *
 * The project historically used `drizzle-kit push` without a migration
 * baseline. This script is intentionally limited to CREATE IF NOT EXISTS so a
 * pre-existing database never receives unrelated inferred drops.
 */
import { sql } from 'drizzle-orm'
import { db } from '../server/db/index.ts'

await db.execute(
  sql.raw(`
  CREATE TABLE IF NOT EXISTS "workspace_access" (
    "id" text PRIMARY KEY NOT NULL,
    "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "role" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`),
)

await db.execute(
  sql.raw(`
  CREATE UNIQUE INDEX IF NOT EXISTS "workspace_access_user_workspace_idx"
  ON "workspace_access" ("user_id", "workspace_id")
`),
)

await db.execute(
  sql.raw(`
  CREATE INDEX IF NOT EXISTS "workspace_access_workspace_role_idx"
  ON "workspace_access" ("workspace_id", "role")
`),
)

await db.execute(
  sql.raw(`
  CREATE TABLE IF NOT EXISTS "workspace_invitation" (
    "id" text PRIMARY KEY NOT NULL,
    "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
    "email" text NOT NULL,
    "role" text NOT NULL,
    "token_hash" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "invited_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
    "accepted_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "workspace_invitation_status_check"
      CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired'))
  )
`),
)

await db.execute(
  sql.raw(`
  CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitation_token_hash_idx"
  ON "workspace_invitation" ("token_hash")
`),
)

await db.execute(
  sql.raw(`
  CREATE INDEX IF NOT EXISTS "workspace_invitation_workspace_status_idx"
  ON "workspace_invitation" ("workspace_id", "status")
`),
)

await db.execute(
  sql.raw(`
  CREATE INDEX IF NOT EXISTS "workspace_invitation_email_status_idx"
  ON "workspace_invitation" ("email", "status")
`),
)

console.log('Workspace access and invitation schema are ready.')
