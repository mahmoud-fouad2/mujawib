import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { CLIENT_ROLES, type ClientRole, OPERATOR_ROLES, type OperatorRole } from '@/lib/access'
import {
  isSafeNotificationHref,
  type NotificationCategory,
  type NotificationSeverity,
} from '@/lib/notifications'
import { db } from '@/server/db'
import { notification, workspace, workspaceAccess } from '@/server/db/schema'

type NotificationPayload = {
  workspaceId?: string | null
  severity: NotificationSeverity
  category: NotificationCategory
  title: string
  message: string
  href?: string | null
  sourceType?: string | null
  sourceId?: string | null
  dedupeKey?: string | null
}

async function deliver(recipientUserIds: string[], payload: NotificationPayload) {
  const recipients = [...new Set(recipientUserIds)]
  if (recipients.length === 0) return 0

  const href = isSafeNotificationHref(payload.href) ? payload.href : null
  const createdAt = new Date()
  await db
    .insert(notification)
    .values(
      recipients.map((recipientUserId) => ({
        id: `notice_${randomUUID().replaceAll('-', '')}`,
        workspaceId: payload.workspaceId ?? null,
        recipientUserId,
        severity: payload.severity,
        category: payload.category,
        title: payload.title.slice(0, 160),
        message: payload.message.slice(0, 500),
        href,
        sourceType: payload.sourceType?.slice(0, 80) ?? null,
        sourceId: payload.sourceId?.slice(0, 160) ?? null,
        dedupeKey: payload.dedupeKey?.slice(0, 240) ?? null,
        createdAt,
      })),
    )
    .onConflictDoNothing()

  return recipients.length
}

export async function notifyWorkspaceMembers(
  input: NotificationPayload & {
    workspaceId: string
    roles?: readonly ClientRole[]
  },
) {
  const roles = input.roles ?? CLIENT_ROLES
  const recipients = await db
    .select({ userId: workspaceAccess.userId })
    .from(workspaceAccess)
    .where(
      and(
        eq(workspaceAccess.workspaceId, input.workspaceId),
        inArray(workspaceAccess.role, [...roles]),
      ),
    )

  return deliver(
    recipients.map((recipient) => recipient.userId),
    input,
  )
}

export async function notifyOperators(
  input: NotificationPayload & {
    roles?: readonly OperatorRole[]
  },
) {
  const roles = input.roles ?? OPERATOR_ROLES
  const recipients = await db
    .select({ userId: workspaceAccess.userId })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .where(and(eq(workspace.type, 'operator'), inArray(workspaceAccess.role, [...roles])))

  return deliver(
    recipients.map((recipient) => recipient.userId),
    input,
  )
}

/** Notifications are secondary delivery; an outage must not roll back the business event. */
export async function tryNotify(task: () => Promise<unknown>) {
  try {
    await task()
  } catch {
    console.error('[notifications] delivery failed')
  }
}
