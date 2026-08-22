import 'server-only'

import { and, count, desc, eq, isNull } from 'drizzle-orm'
import type {
  NotificationCategory,
  NotificationFeed,
  NotificationSeverity,
} from '@/lib/notifications'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { notification } from '@/server/db/schema'

export async function getNotificationsForCurrentUser(options?: {
  workspaceId?: string
  limit?: number
}): Promise<NotificationFeed> {
  const session = await getSession()
  if (!session) return { items: [], unreadCount: 0 }

  const filter = and(
    eq(notification.recipientUserId, session.user.id),
    options?.workspaceId ? eq(notification.workspaceId, options.workspaceId) : undefined,
  )
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 30)
  const [rows, unread] = await Promise.all([
    db.select().from(notification).where(filter).orderBy(desc(notification.createdAt)).limit(limit),
    db
      .select({ value: count() })
      .from(notification)
      .where(and(filter, isNull(notification.readAt))),
  ])
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return {
    items: rows.map((row) => ({
      id: row.id,
      severity: row.severity as NotificationSeverity,
      category: row.category as NotificationCategory,
      title: row.title,
      message: row.message,
      href: row.href,
      read: row.readAt !== null,
      createdLabel: formatter.format(row.createdAt),
    })),
    unreadCount: unread[0]?.value ?? 0,
  }
}
