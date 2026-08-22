import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import {
  type PhoneLifecycle,
  type PhoneVerificationEvidence,
  phoneNumber,
} from '@/server/db/schema'
import { sanitizeLogText, voiceError, voiceLog } from '@/server/voice/log'

/**
 * The verification state of a real phone number.
 *
 *   pending → verifying → verified → active
 *                                ↘ degraded
 *   any state → disabled
 *
 * Every transition is written by something that actually happened on the wire.
 * A number is not verified because it was configured, because the carrier
 * dashboard says forwarding is on, or because an operator pressed a button —
 * only because a call arrived on it and the agent answered.
 *
 * That distinction is the point: `pending` and `verifying` are the two failure
 * modes of a new number, and they are different problems. `pending` after a
 * test call means the call never reached us — carrier forwarding or the SIP
 * trunk. `verifying` means it reached us and we resolved the route but could
 * not answer — our side.
 */

/**
 * A call reached us on this number and resolved to an agent, but was not
 * answered. Proves ingress; proves nothing beyond it.
 */
export async function markPhoneReached(phoneNumberId: string): Promise<void> {
  await withPhone(phoneNumberId, async (row) => {
    if (row.sipStatus !== 'pending') return unchanged(phoneNumberId, row.sipStatus)
    await writeState(phoneNumberId, row.sipStatus, 'verifying')
  })
}

/**
 * A call reached us on this number and the agent answered it.
 *
 * The first such call verifies the number and records what proved it. A later
 * one promotes it to `active`: verified means the path worked once, active
 * means the number is carrying calls. `verifiedAt` and the evidence are
 * written once and never overwritten — they describe the first call, which is
 * the one worth being able to go back and read.
 */
export async function markPhoneAnswered(
  phoneNumberId: string,
  evidence: PhoneVerificationEvidence,
): Promise<void> {
  await withPhone(phoneNumberId, async (row) => {
    if (row.sipStatus === 'disabled') return unchanged(phoneNumberId, row.sipStatus)
    const next: PhoneLifecycle = row.verifiedAt ? 'active' : 'verified'
    await writeState(phoneNumberId, row.sipStatus, next, row.verifiedAt ? null : evidence)
  })
}

/** Ops may activate only a route that a real answered call has proved. */
export async function markPhoneActive(phoneNumberId: string): Promise<boolean> {
  return withPhone(phoneNumberId, async (row) => {
    if (!row.verifiedAt) return false
    await writeState(phoneNumberId, row.sipStatus, 'active')
    return true
  })
}

/** Runtime/ops signal that a previously proven route currently needs attention. */
export async function markPhoneDegraded(phoneNumberId: string): Promise<boolean> {
  return withPhone(phoneNumberId, async (row) => {
    if (!row.verifiedAt || row.sipStatus === 'disabled') return false
    await writeState(phoneNumberId, row.sipStatus, 'degraded')
    return true
  })
}

/** Explicit operator shutdown. A real call must never silently re-enable it. */
export async function markPhoneDisabled(phoneNumberId: string): Promise<boolean> {
  return withPhone(phoneNumberId, async (row) => {
    await writeState(phoneNumberId, row.sipStatus, 'disabled')
    return true
  })
}

type PhoneStateRow = { sipStatus: PhoneLifecycle; verifiedAt: Date | null }

async function withPhone<T>(
  phoneNumberId: string,
  operation: (row: PhoneStateRow) => Promise<T>,
): Promise<T | false> {
  try {
    const [row] = await db
      .select({ sipStatus: phoneNumber.sipStatus, verifiedAt: phoneNumber.verifiedAt })
      .from(phoneNumber)
      .where(eq(phoneNumber.id, phoneNumberId))
      .limit(1)

    if (!row) return false
    return await operation({
      sipStatus: (row.sipStatus ?? 'pending') as PhoneLifecycle,
      verifiedAt: row.verifiedAt,
    })
  } catch (error) {
    // Bookkeeping must never end a call that is already up.
    voiceError('ERROR', `phone state update failed: ${sanitizeLogText(String(error))}`)
    return false
  }
}

function unchanged(phoneNumberId: string, state: PhoneLifecycle) {
  voiceLog('PHONE_STATE', { phoneNumberId, state, note: 'unchanged' })
}

async function writeState(
  phoneNumberId: string,
  current: PhoneLifecycle,
  next: PhoneLifecycle,
  evidence: PhoneVerificationEvidence | null = null,
) {
  if (current === next) return unchanged(phoneNumberId, current)

  const now = new Date()
  await db
    .update(phoneNumber)
    .set({
      sipStatus: next,
      lastTestAt: now,
      updatedAt: now,
      ...(evidence ? { verifiedAt: now, verificationEvidence: evidence } : {}),
    })
    .where(eq(phoneNumber.id, phoneNumberId))

  voiceLog('PHONE_STATE', { phoneNumberId, from: current, to: next })
}
