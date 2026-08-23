import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { auditLog } from '@/server/db/schema'
import { dataEncryptionKeyFingerprint } from '@/server/security/protected-data'

/**
 * Catches a signing or encryption secret changing under the running app,
 * before a real user's login or a real caller's transcript hits it.
 *
 * The incident this exists for: `BETTER_AUTH_SECRET` differed between when an
 * operator enrolled two-factor and when they next tried to sign in. Nothing
 * about that is visible until someone actually attempts the affected
 * operation — the server boots cleanly, every page renders, and the first
 * sign anything is wrong is a stranger-looking "invalid tag" deep in a
 * decrypt call, on the one request path that happens to touch it. A team of
 * one found this by accident; a team of five would find it once per person
 * enrolled, on whatever unlucky day they next sign in.
 *
 * This runs once per boot (from instrumentation.ts) and asks a narrower
 * question up front: does the secret this process is using match the one the
 * last successful boot used? A fingerprint — not the secret — is the record,
 * so this is safe to log and to keep in the audit trail indefinitely. Nothing
 * here can fix a drift automatically: encrypted data is either readable under
 * the current key or it is not, and guessing at automatic recovery is worse
 * than a clear, loud, actionable warning naming exactly what changed and what
 * to run next. The System page reads the same audit rows this writes, so the
 * warning survives past whatever log retention Render applies.
 */

type SecretKind = 'better_auth_secret' | 'data_encryption_key'

const RESOURCE_TYPE = 'system_secret'

function fingerprintOf(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

async function checkOne(kind: SecretKind, current: string | null): Promise<void> {
  if (current === null) return // Not configured — nothing to compare yet.

  const [latest] = await db
    .select({ metadata: auditLog.metadata, createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(eq(auditLog.resourceId, kind))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)

  const previous = (latest?.metadata as { fingerprint?: string } | undefined)?.fingerprint

  if (previous === undefined) {
    await db.insert(auditLog).values({
      id: `audit_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      workspaceId: null,
      actorId: 'system',
      action: 'system.secret_baseline',
      resourceType: RESOURCE_TYPE,
      resourceId: kind,
      metadata: { fingerprint: current },
      createdAt: new Date(),
    })
    console.log(`[secret-drift] ${kind}: baseline recorded (${current})`)
    return
  }

  if (previous === current) return // Unchanged since last boot — nothing to do.

  await db.insert(auditLog).values({
    id: `audit_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    workspaceId: null,
    actorId: 'system',
    action: 'system.secret_drift',
    resourceType: RESOURCE_TYPE,
    resourceId: kind,
    metadata: { fingerprint: current, previousFingerprint: previous },
    createdAt: new Date(),
  })

  console.error(
    `[secret-drift] ${kind} changed since the last boot (${previous} -> ${current}). ` +
      (kind === 'better_auth_secret'
        ? 'Every two-factor enrolment made under the old secret can no longer be verified — ' +
          'affected accounts see "invalid tag" on /api/auth/two-factor/verify-totp. ' +
          'Run `pnpm 2fa:status <email>` to confirm, then `pnpm 2fa:reset <email>` to let them ' +
          're-enrol.'
        : 'Data protected under the old key — caller numbers, transcripts, tool payloads — now ' +
          'reads back as empty rather than erroring, because reveal() fails closed. Rows written ' +
          'before this boot may be unrecoverable under the current key.'),
  )
}

export async function checkSecretDrift(): Promise<void> {
  try {
    await Promise.all([
      checkOne('better_auth_secret', fingerprintOf(env.BETTER_AUTH_SECRET)),
      checkOne('data_encryption_key', dataEncryptionKeyFingerprint()),
    ])
  } catch (error) {
    // Diagnostics must never block the app from serving traffic.
    console.error('[secret-drift] check failed:', error)
  }
}
