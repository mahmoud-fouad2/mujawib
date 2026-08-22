/**
 * Grants the first explicit MUJAWIB owner access.
 *
 *   pnpm access:bootstrap [email]
 *
 * Without an email this is deliberately safe: it proceeds only when exactly
 * one identity exists. It never creates an identity or changes a password.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../server/db/index.ts'
import { user, workspace, workspaceAccess } from '../server/db/schema/index.ts'

const requestedEmail = process.argv[2]?.trim().toLowerCase()
const users = await db.select({ id: user.id, email: user.email }).from(user).orderBy(user.createdAt)

const target = requestedEmail
  ? users.find((candidate) => candidate.email.toLowerCase() === requestedEmail)
  : users.length === 1
    ? users[0]
    : null

if (!target) {
  console.error(
    requestedEmail
      ? `No account exists for ${requestedEmail}.`
      : `Expected exactly one account, found ${users.length}. Pass the owner email explicitly.`,
  )
  process.exit(1)
}

const [operatorWorkspace] = await db
  .select({ id: workspace.id, name: workspace.name })
  .from(workspace)
  .where(eq(workspace.type, 'operator'))
  .limit(1)

if (!operatorWorkspace) {
  console.error('No operator workspace exists. Run the operational seed or onboarding setup first.')
  process.exit(1)
}

const now = new Date()
await db
  .insert(workspaceAccess)
  .values({
    id: `access_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    workspaceId: operatorWorkspace.id,
    userId: target.id,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  })
  .onConflictDoUpdate({
    target: [workspaceAccess.userId, workspaceAccess.workspaceId],
    set: { role: 'owner', updatedAt: now },
  })

console.log(`Owner access granted to ${target.email} for ${operatorWorkspace.name}.`)
