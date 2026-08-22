import 'server-only'

import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import {
  type ClientPermission,
  canClient,
  canOperator,
  isClientRole,
  isOperatorRole,
  type OperatorPermission,
} from '@/lib/access'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { workspace, workspaceAccess } from '@/server/db/schema'

export type OperatorAccess = {
  userId: string
  email: string
  name: string
  workspaceId: string
  role: string
  twoFactorEnabled: boolean
}

export type PortalAccess = {
  userId: string
  email: string
  name: string
  role: string
  workspace: typeof workspace.$inferSelect
}

export const PORTAL_WORKSPACE_COOKIE = 'mujawib.portal-workspace'

const currentSession = cache(getSession)

const operatorAccessForUser = cache(async (userId: string) => {
  const rows = await db
    .select({
      workspaceId: workspace.id,
      role: workspaceAccess.role,
    })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .where(and(eq(workspaceAccess.userId, userId), eq(workspace.type, 'operator')))

  return rows.find((row) => isOperatorRole(row.role)) ?? null
})

export async function getOperatorAccess(): Promise<OperatorAccess | null> {
  const session = await currentSession()
  if (!session) return null
  const access = await operatorAccessForUser(session.user.id)
  if (!access) return null
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    workspaceId: access.workspaceId,
    role: access.role,
    twoFactorEnabled: Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
  }
}

export async function authorizeOperator(
  permission: OperatorPermission,
): Promise<OperatorAccess | null> {
  const access = await getOperatorAccess()
  return access?.twoFactorEnabled && canOperator(access.role, permission) ? access : null
}

export async function requireOperatorPage(returnTo = '/console'): Promise<OperatorAccess> {
  const session = await currentSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`)
  const access = await operatorAccessForUser(session.user.id)
  if (!access || !canOperator(access.role, 'console.view')) {
    redirect('/access-denied?area=console')
  }
  const twoFactorEnabled = Boolean(
    (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
  )
  if (!twoFactorEnabled) {
    redirect('/account/security?required=operator')
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    workspaceId: access.workspaceId,
    role: access.role,
    twoFactorEnabled,
  }
}

export async function requireOperatorPermissionPage(
  permission: OperatorPermission,
  returnTo: string,
): Promise<OperatorAccess> {
  const access = await requireOperatorPage(returnTo)
  if (!canOperator(access.role, permission)) redirect('/access-denied?area=console')
  return access
}

const portalAccessForUser = cache(
  async (userId: string, slug?: string): Promise<PortalAccess | null> => {
    const rows = await db
      .select({
        role: workspaceAccess.role,
        workspace,
      })
      .from(workspaceAccess)
      .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
      .where(
        and(
          eq(workspaceAccess.userId, userId),
          eq(workspace.type, 'client'),
          slug ? eq(workspace.slug, slug) : undefined,
        ),
      )
      .orderBy(workspace.name)

    const access = rows.find((row) => isClientRole(row.role))
    return access
      ? { userId, email: '', name: '', role: access.role, workspace: access.workspace }
      : null
  },
)

export async function getPortalAccess(slug?: string): Promise<PortalAccess | null> {
  const session = await currentSession()
  if (!session) return null
  const selectedSlug = slug ?? (await cookies()).get(PORTAL_WORKSPACE_COOKIE)?.value
  const access = await portalAccessForUser(session.user.id, selectedSlug)
  const fallback = access ?? (selectedSlug ? await portalAccessForUser(session.user.id) : null)
  return fallback ? { ...fallback, email: session.user.email, name: session.user.name } : null
}

export async function requirePortalPage(returnTo = '/portal'): Promise<PortalAccess> {
  const session = await currentSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`)
  const selectedSlug = (await cookies()).get(PORTAL_WORKSPACE_COOKIE)?.value
  const access =
    (await portalAccessForUser(session.user.id, selectedSlug)) ??
    (selectedSlug ? await portalAccessForUser(session.user.id) : null)
  if (!access || !canClient(access.role, 'portal.view')) {
    redirect('/access-denied?area=portal')
  }
  return { ...access, email: session.user.email, name: session.user.name }
}

export async function authorizeClientWorkspace(
  workspaceId: string,
  permission: ClientPermission,
): Promise<PortalAccess | null> {
  const session = await currentSession()
  if (!session) return null
  const [row] = await db
    .select({ role: workspaceAccess.role, workspace })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .where(
      and(
        eq(workspaceAccess.userId, session.user.id),
        eq(workspaceAccess.workspaceId, workspaceId),
        eq(workspace.type, 'client'),
      ),
    )
    .limit(1)

  if (!row || !canClient(row.role, permission)) return null
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: row.role,
    workspace: row.workspace,
  }
}

export async function getPortalWorkspacesForCurrentUser() {
  const session = await currentSession()
  if (!session) return []
  const rows = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      role: workspaceAccess.role,
    })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .where(and(eq(workspaceAccess.userId, session.user.id), eq(workspace.type, 'client')))
    .orderBy(workspace.name)

  return rows.filter((row) => isClientRole(row.role))
}
