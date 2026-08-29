import 'server-only'

import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/server/db'
import { user, workspace, workspaceAccess, workspaceInvitation } from '@/server/db/schema'

// This page is genuinely meant to show the whole directory to an owner, not
// a paginated list — but "whole directory" and "no limit at all" are not the
// same promise. This is a safety ceiling against unbounded growth, not a
// product-facing page size.
const DIRECTORY_SAFETY_LIMIT = 1000

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
      .orderBy(workspace.type, workspace.name)
      .limit(DIRECTORY_SAFETY_LIMIT),
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
      .orderBy(workspace.type, workspace.name, user.name)
      .limit(DIRECTORY_SAFETY_LIMIT),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .orderBy(user.name)
      .limit(DIRECTORY_SAFETY_LIMIT),
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
      .orderBy(workspaceInvitation.createdAt)
      .limit(DIRECTORY_SAFETY_LIMIT),
  ])

  return { workspaces, memberships, users, invitations }
}
