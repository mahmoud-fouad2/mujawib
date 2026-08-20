import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import {
  type PhoneLifecycle,
  type PhoneVerificationEvidence,
  phoneNumber,
} from '@/server/db/schema'
import { voiceError, voiceLog } from '@/server/voice/log'

/**
 * The verification state of a real phone number.
 *
 *   pending → verifying → verified → active
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

/** Rank used so a state is never silently walked backwards. */
const RANK: Record<PhoneLifecycle, number> = {
  pending: 0,
  verifying: 1,
  verified: 2,
  active: 3,
}

function rankOf(status: string | null): number {
  return RANK[(status ?? 'pending') as PhoneLifecycle] ?? 0
}

/**
 * A call reached us on this number and resolved to an agent, but was not
 * answered. Proves ingress; proves nothing beyond it.
 */
export async function markPhoneReached(phoneNumberId: string): Promise<void> {
  await transition(phoneNumberId, 'verifying', null)
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
  await transition(phoneNumberId, 'verified', evidence)
}

async function transition(
  phoneNumberId: string,
  target: PhoneLifecycle,
  evidence: PhoneVerificationEvidence | null,
): Promise<void> {
  try {
    const [row] = await db
      .select({ sipStatus: phoneNumber.sipStatus, verifiedAt: phoneNumber.verifiedAt })
      .from(phoneNumber)
      .where(eq(phoneNumber.id, phoneNumberId))
      .limit(1)

    if (!row) return

    const current = (row.sipStatus ?? 'pending') as PhoneLifecycle

    // An answered call on a number that is already verified means it is in
    // service, not that it needs verifying again.
    const next: PhoneLifecycle =
      target === 'verified' && rankOf(current) >= RANK.verified ? 'active' : target

    if (rankOf(next) <= rankOf(current)) {
      voiceLog('PHONE_STATE', { phoneNumberId, state: current, note: 'unchanged' })
      return
    }

    const now = new Date()
    await db
      .update(phoneNumber)
      .set({
        sipStatus: next,
        lastTestAt: now,
        updatedAt: now,
        // Written once, on the call that first proved the number.
        ...(evidence && !row.verifiedAt ? { verifiedAt: now, verificationEvidence: evidence } : {}),
      })
      .where(eq(phoneNumber.id, phoneNumberId))

    voiceLog('PHONE_STATE', { phoneNumberId, from: current, to: next })
  } catch (error) {
    // Bookkeeping must never end a call that is already up.
    voiceError('ERROR', `phone state update failed: ${String(error)}`)
  }
}
