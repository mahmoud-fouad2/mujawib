'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { notification } from '@/server/db/schema'

const notificationId = z.string().trim().min(1).max(100)

function refreshNotificationSurfaces() {
  revalidatePath('/console', 'layout')
  revalidatePath('/portal', 'layout')
}

export async function markNotificationRead(id: string) {
  const parsed = notificationId.safeParse(id)
  if (!parsed.success) return { ok: false as const }
  const session = await getSession()
  if (!session) return { ok: false as const }

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.id, parsed.data),
        eq(notification.recipientUserId, session.user.id),
        isNull(notification.readAt),
      ),
    )

  refreshNotificationSurfaces()
  return { ok: true as const }
}

export async function markAllNotificationsRead(workspaceId?: string) {
  const session = await getSession()
  if (!session) return { ok: false as const }
  const scope = workspaceId ? notificationId.safeParse(workspaceId) : null
  if (scope && !scope.success) return { ok: false as const }

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.recipientUserId, session.user.id),
        isNull(notification.readAt),
        scope?.success ? eq(notification.workspaceId, scope.data) : undefined,
      ),
    )

  refreshNotificationSurfaces()
  return { ok: true as const }
}
