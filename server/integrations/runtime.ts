import 'server-only'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { type IntegrationAction, normalizeIntegrationConfig } from '@/lib/integrations'
import { db } from '@/server/db'
import { integrationConnection } from '@/server/db/schema'
import { safeIntegrationRequest } from '@/server/integrations/http'
import { notifyOperators, notifyWorkspaceMembers, tryNotify } from '@/server/notifications/service'

type Connection = typeof integrationConnection.$inferSelect

export type IntegrationFailureCode =
  | 'not_configured'
  | 'credential_missing'
  | 'unavailable'
  | 'invalid_response'

export type IntegrationResult<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; code: IntegrationFailureCode; latencyMs: number }

const availabilityResponse = z.object({
  slots: z.array(z.string().min(1)).max(20),
})

const bookingResponse = z.object({ bookingId: z.string().min(1).max(200) })

const messageResponse = z.union([
  z.object({ messageId: z.string().min(1).max(200) }),
  z.object({ sent: z.literal(true) }),
])

async function persistHealth(connection: Connection, result: IntegrationResult<unknown>) {
  const now = new Date()
  if (result.ok) {
    await db
      .update(integrationConnection)
      .set({ health: 'connected', lastSuccessAt: now, updatedAt: now })
      .where(eq(integrationConnection.id, connection.id))
    return
  }

  const configurationFailure =
    result.code === 'not_configured' || result.code === 'credential_missing'
  const nextHealth = configurationFailure
    ? 'disconnected'
    : connection.health === 'connected'
      ? 'degraded'
      : 'failed'

  await db
    .update(integrationConnection)
    .set({ health: nextHealth, lastErrorAt: now, updatedAt: now })
    .where(eq(integrationConnection.id, connection.id))

  if (connection.health !== nextHealth) {
    const window = Math.floor(now.getTime() / (15 * 60 * 1000))
    const severity = nextHealth === 'degraded' ? 'warning' : 'critical'
    const stateLabel = nextHealth === 'degraded' ? 'أصبح غير مستقر' : 'يحتاج تدخلًا'
    await tryNotify(async () => {
      await Promise.all([
        notifyOperators({
          workspaceId: connection.workspaceId,
          roles: ['owner', 'ops', 'integrator'],
          severity,
          category: 'integration',
          title: `الربط ${stateLabel}`,
          message: `${connection.label}: فشلت عملية تحقق تشغيلية.`,
          href: '/console/integrations',
          sourceType: 'integration_connection',
          sourceId: connection.id,
          dedupeKey: `integration:${connection.id}:${nextHealth}:${window}`,
        }),
        notifyWorkspaceMembers({
          workspaceId: connection.workspaceId,
          roles: ['client_admin', 'client_manager'],
          severity,
          category: 'integration',
          title: 'الربط يحتاج متابعة',
          message: `${connection.label}: نتابع مشكلة اتصال تؤثر في بعض العمليات.`,
          href: '/portal/integrations',
          sourceType: 'integration_connection',
          sourceId: connection.id,
          dedupeKey: `integration:${connection.id}:${nextHealth}:${window}`,
        }),
      ])
    })
  }
}

function validateResponse(action: IntegrationAction, value: unknown): unknown | null {
  if (action === 'health') return value
  const schema =
    action === 'availability'
      ? availabilityResponse
      : action === 'booking'
        ? bookingResponse
        : messageResponse
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export async function invokeIntegration<T = Record<string, unknown>>(input: {
  connection: Connection
  action: IntegrationAction
  payload?: Record<string, unknown>
}): Promise<IntegrationResult<T>> {
  const config = normalizeIntegrationConfig(input.connection.config)
  const endpoint = config.endpoints[input.action]
  if (!endpoint) {
    const result: IntegrationResult<T> = { ok: false, code: 'not_configured', latencyMs: 0 }
    await persistHealth(input.connection, result)
    return result
  }

  const response = await safeIntegrationRequest({
    endpoint,
    method: input.action === 'health' ? 'GET' : 'POST',
    ...(input.payload ? { body: input.payload } : {}),
    credentialsRef: input.connection.credentialsRef,
  })

  if (!response.ok) {
    const code: IntegrationFailureCode =
      response.code === 'credential_missing' ? 'credential_missing' : 'unavailable'
    const result: IntegrationResult<T> = { ok: false, code, latencyMs: response.latencyMs }
    await persistHealth(input.connection, result)
    return result
  }

  const data = validateResponse(input.action, response.data)
  if (data === null) {
    const result: IntegrationResult<T> = {
      ok: false,
      code: 'invalid_response',
      latencyMs: response.latencyMs,
    }
    await persistHealth(input.connection, result)
    return result
  }

  const result: IntegrationResult<T> = {
    ok: true,
    data: data as T,
    latencyMs: response.latencyMs,
  }
  await persistHealth(input.connection, result)
  return result
}
