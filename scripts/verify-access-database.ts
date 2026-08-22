import { and, eq, sql } from 'drizzle-orm'
import { db } from '../server/db/index.ts'
import { user, workspace, workspaceAccess, workspaceInvitation } from '../server/db/schema/index.ts'

const [summary] = await db
  .select({
    total: sql<number>`count(*)`.mapWith(Number),
    owners:
      sql<number>`count(*) filter (where ${workspaceAccess.role} = 'owner' and ${workspace.type} = 'operator')`.mapWith(
        Number,
      ),
  })
  .from(workspaceAccess)
  .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
  .innerJoin(user, eq(workspaceAccess.userId, user.id))

const [invalidRoleShape] = await db
  .select({ count: sql<number>`count(*)`.mapWith(Number) })
  .from(workspaceAccess)
  .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
  .where(
    sql`not (
      (${workspace.type} = 'operator' and ${workspaceAccess.role} in ('owner','ops','qa','integrator'))
      or
      (${workspace.type} = 'client' and ${workspaceAccess.role} in ('client_admin','client_manager','client_reviewer','client_read_only'))
    )`,
  )

const [duplicate] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(
  db
    .select({
      userId: workspaceAccess.userId,
      workspaceId: workspaceAccess.workspaceId,
      count: sql<number>`count(*)`.as('membership_count'),
    })
    .from(workspaceAccess)
    .groupBy(workspaceAccess.userId, workspaceAccess.workspaceId)
    .having(sql`count(*) > 1`)
    .as('duplicate_memberships'),
)

const [invitationSummary] = await db
  .select({
    total: sql<number>`count(*)`.mapWith(Number),
    invalid: sql<number>`count(*) filter (where not (
      (${workspace.type} = 'operator' and ${workspaceInvitation.role} in ('owner','ops','qa','integrator'))
      or
      (${workspace.type} = 'client' and ${workspaceInvitation.role} in ('client_admin','client_manager','client_reviewer','client_read_only'))
    ))`.mapWith(Number),
  })
  .from(workspaceInvitation)
  .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))

if ((summary?.owners ?? 0) < 1) throw new Error('No operator owner is configured.')
if ((invalidRoleShape?.count ?? 0) > 0)
  throw new Error('A role is attached to the wrong workspace type.')
if ((duplicate?.count ?? 0) > 0) throw new Error('Duplicate workspace memberships exist.')
if ((invitationSummary?.invalid ?? 0) > 0)
  throw new Error('An invitation role is attached to the wrong workspace type.')

const [owner] = await db
  .select({ workspaceId: workspaceAccess.workspaceId })
  .from(workspaceAccess)
  .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
  .where(and(eq(workspace.type, 'operator'), eq(workspaceAccess.role, 'owner')))
  .limit(1)

if (!owner?.workspaceId) throw new Error('Owner access does not resolve to an operator workspace.')

console.log(
  `Access database verified: ${summary?.total ?? 0} membership(s), ${summary?.owners ?? 0} operator owner(s), ${invitationSummary?.total ?? 0} invitation(s).`,
)
