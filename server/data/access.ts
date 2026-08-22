import 'server-only'

import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/server/db'
import { user, workspace, workspaceAccess, workspaceInvitation } from '@/server/db/schema'

export async function getAccessDirectory() {
  const [workspaces, memberships, users, invitations] = await Promise.all([
    db
      .select({
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        status: workspace.status,
      })
      .from(workspace)
      .orderBy(workspace.type, workspace.name),
    db
      .select({
        id: workspaceAccess.id,
        userId: workspaceAccess.userId,
        name: user.name,
        email: user.email,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceType: workspace.type,
        role: workspaceAccess.role,
        updatedAt: workspaceAccess.updatedAt,
      })
      .from(workspaceAccess)
      .innerJoin(user, eq(workspaceAccess.userId, user.id))
      .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
      .orderBy(workspace.type, workspace.name, user.name),
    db.select({ id: user.id, name: user.name, email: user.email }).from(user).orderBy(user.name),
    db
      .select({
        id: workspaceInvitation.id,
        email: workspaceInvitation.email,
        role: workspaceInvitation.role,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceType: workspace.type,
        expiresAt: workspaceInvitation.expiresAt,
        createdAt: workspaceInvitation.createdAt,
      })
      .from(workspaceInvitation)
      .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))
      .where(
        and(
          eq(workspaceInvitation.status, 'pending'),
          gt(workspaceInvitation.expiresAt, new Date()),
        ),
      )
      .orderBy(workspaceInvitation.createdAt),
  ])

  return { workspaces, memberships, users, invitations }
}
