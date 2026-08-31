import 'server-only'

import { and, eq, sql } from 'drizzle-orm'
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
  twoFactorEnabled: boolean
  /**
   * True when an operator is looking at a client's portal rather than the
   * client themselves. The portal must say so on screen: the two look
   * identical otherwise, and an operator who forgets which one they are in
   * will read "your calls" as their own.
   */
  viewingAsOperator?: boolean
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

type PortalMembership = {
  userId: string
  role: string
  workspace: typeof workspace.$inferSelect
  viewingAsOperator?: boolean
}

const portalAccessForUser = cache(
  async (userId: string, slug?: string): Promise<PortalMembership | null> => {
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
    return access ? { userId, role: access.role, workspace: access.workspace } : null
  },
)

/** Session fields every PortalAccess needs, read the same way OperatorAccess reads them. */
function sessionPortalFields(session: NonNullable<Awaited<ReturnType<typeof currentSession>>>) {
  return {
    email: session.user.email,
    name: session.user.name,
    twoFactorEnabled: Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
  }
}

export async function getPortalAccess(slug?: string): Promise<PortalAccess | null> {
  const session = await currentSession()
  if (!session) return null
  const selectedSlug = slug ?? (await cookies()).get(PORTAL_WORKSPACE_COOKIE)?.value
  const access = await portalAccessForUser(session.user.id, selectedSlug)
  const fallback =
    access ??
    (selectedSlug ? await portalAccessForUser(session.user.id) : null) ??
    (await operatorPortalView(session.user.id, selectedSlug))
  return fallback ? { ...fallback, ...sessionPortalFields(session) } : null
}

/**
 * Lets an operator open a client's portal without holding a client role.
 *
 * The platform owner could see every one of a client's calls in the console
 * yet was refused their portal, because portal access was keyed purely on a
 * client role in a client workspace. That made "open their portal" — the
 * fastest way to answer "what is the customer actually seeing?" — impossible
 * for the person running the platform.
 *
 * Grants `client_admin` — full control, matching what this operator can
 * already do to the same client from the console's own edit sheet
 * (server/actions/console.ts's `updateClient`, archive, delete). Restricting
 * this to read-only was a mistake: it made the portal look like a
 * display-only surface with no real control, when the actual gap was that
 * the person operating the platform could not use the controls that were
 * already there. The `viewingAsOperator` flag still marks every action as
 * done on the client's behalf rather than silently as the client — the
 * banner in the portal shell says so — but it no longer blocks the action.
 */
async function operatorPortalView(
  userId: string,
  slug: string | undefined,
): Promise<PortalMembership | null> {
  const operator = await operatorAccessForUser(userId)
  if (!operator || !canOperator(operator.role, 'client.manage')) return null

  const [row] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.type, 'client'), slug ? eq(workspace.slug, slug) : undefined))
    .orderBy(workspace.name)
    .limit(1)
  if (!row) return null

  return { userId, role: 'client_admin', workspace: row, viewingAsOperator: true }
}

export async function requirePortalPage(returnTo = '/portal'): Promise<PortalAccess> {
  const session = await currentSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`)
  const selectedSlug = (await cookies()).get(PORTAL_WORKSPACE_COOKIE)?.value
  const access =
    (await portalAccessForUser(session.user.id, selectedSlug)) ??
    (selectedSlug ? await portalAccessForUser(session.user.id) : null) ??
    (await operatorPortalView(session.user.id, selectedSlug))
  if (!access || !canClient(access.role, 'portal.view')) {
    redirect('/access-denied?area=portal')
  }
  const fields = sessionPortalFields(session)
  // Mirrors requireOperatorPage exactly: a client-portal session gets the
  // same page-level 2FA gate an operator session already has. Password-only
  // access to a client's own customer data was the one asymmetry the console
  // side didn't have — a compromised portal password used to be enough on
  // its own for account takeover.
  if (!fields.twoFactorEnabled) {
    redirect('/account/security?required=portal')
  }
  return { ...access, ...fields }
}

/**
 * The same `client_admin` grant `operatorPortalView` gives the page load,
 * checked here against one specific workspace rather than picked by slug —
 * this is what every portal server action calls, and it queries
 * `workspaceAccess` directly rather than going through `getPortalAccess`, so
 * it needed the same fallback rather than inheriting it for free. Without
 * this, the page would have shown edit buttons an operator's click could
 * never actually complete — worse than not showing them, since a control
 * that visibly fails reads as broken rather than as absent.
 */
async function operatorClientAdminAccess(
  userId: string,
  workspaceId: string,
): Promise<PortalMembership | null> {
  const operator = await operatorAccessForUser(userId)
  if (!operator || !canOperator(operator.role, 'client.manage')) return null

  const [row] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), eq(workspace.type, 'client')))
    .limit(1)
  if (!row) return null

  return { userId, role: 'client_admin', workspace: row, viewingAsOperator: true }
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

  const fields = sessionPortalFields(session)

  if (row && canClient(row.role, permission)) {
    // The page-level redirect in requirePortalPage does not stop a Server
    // Action from being invoked directly, so the same 2FA requirement is
    // re-checked here — matching authorizeOperator's own
    // `access?.twoFactorEnabled && canOperator(...)` pattern for the console.
    if (!fields.twoFactorEnabled) return null
    return {
      userId: session.user.id,
      role: row.role,
      workspace: row.workspace,
      ...fields,
    }
  }

  const operatorAccess = await operatorClientAdminAccess(session.user.id, workspaceId)
  if (!operatorAccess || !canClient(operatorAccess.role, permission)) return null
  if (!fields.twoFactorEnabled) return null
  return { ...operatorAccess, ...fields }
}

export async function getPortalWorkspacesForCurrentUser() {
  const session = await currentSession()
  if (!session) return []
  const operator = await operatorAccessForUser(session.user.id)
  if (operator && canOperator(operator.role, 'client.manage')) {
    return db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        status: workspace.status,
        role: sql<'client_admin'>`'client_admin'`,
      })
      .from(workspace)
      .where(eq(workspace.type, 'client'))
      .orderBy(workspace.name)
  }

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
