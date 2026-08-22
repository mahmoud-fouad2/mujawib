import assert from 'node:assert/strict'
import { and, eq, inArray } from 'drizzle-orm'
import { isSafeNotificationHref } from '../lib/notifications.ts'
import { db } from '../server/db/index.ts'
import { notification, workspace, workspaceAccess } from '../server/db/schema/index.ts'
import { notifyOperators } from '../server/notifications/service.ts'

assert.equal(isSafeNotificationHref('/console/calls?call=abc'), true)
assert.equal(isSafeNotificationHref('//attacker.example/path'), false)
assert.equal(isSafeNotificationHref('https://attacker.example/path'), false)

const dedupeKey = `contract:notification:${Date.now()}`
const unsafeKey = `${dedupeKey}:unsafe`

try {
  const owners = await db
    .select({ userId: workspaceAccess.userId })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .where(and(eq(workspace.type, 'operator'), eq(workspaceAccess.role, 'owner')))
  const ownerIds = [...new Set(owners.map((owner) => owner.userId))]
  assert.ok(ownerIds.length > 0, 'An operator owner is required for the notification contract test')

  const payload = {
    roles: ['owner'] as const,
    severity: 'info' as const,
    category: 'system' as const,
    title: 'Notification contract check',
    message: 'Transient verification record',
    href: '/console',
    sourceType: 'contract',
    sourceId: dedupeKey,
    dedupeKey,
  }
  await notifyOperators(payload)
  await notifyOperators(payload)

  const deduped = await db.select().from(notification).where(eq(notification.dedupeKey, dedupeKey))
  assert.equal(deduped.length, ownerIds.length, 'Dedupe must keep one record per recipient')
  assert.ok(deduped.every((row) => row.href === '/console'))

  await notifyOperators({ ...payload, href: 'https://attacker.example', dedupeKey: unsafeKey })
  const unsafe = await db
    .select({ href: notification.href })
    .from(notification)
    .where(eq(notification.dedupeKey, unsafeKey))
  assert.equal(unsafe.length, ownerIds.length)
  assert.ok(
    unsafe.every((row) => row.href === null),
    'External notification URLs must be removed',
  )

  console.log('Notification contract verified against the database.')
} finally {
  await db.delete(notification).where(inArray(notification.dedupeKey, [dedupeKey, unsafeKey]))
}
