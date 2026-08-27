import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { customer } from '@/server/db/schema'

/**
 * Turns a name+phone the voice agent actually captured — a booking, a
 * callback request — into a CRM contact, so the CRM has real data in it
 * without a client having to type in everyone who has ever called.
 *
 * Deliberately not called for every accepted call: a bare, unidentified call
 * (wrong number, hang-up, a question with no name given) is not "a
 * customer." This runs only from the two tool handlers that already have the
 * caller's own stated name and phone — `createBooking` and `createCallback`
 * in server/voice/handlers.ts — so a CRM row means someone told the agent who
 * they were, once.
 *
 * Idempotent on `(workspaceId, phone)`: a repeat caller updates the existing
 * row (fresher name, later `lastCallAt`) rather than duplicating it, and a
 * contact a client already entered by hand keeps its id and its `source`
 * when it later matches an inbound call — the row is one person, not two.
 */
export async function upsertCustomerFromContact(input: {
  workspaceId: string
  phone: string
  name: string | null
  when: Date
}): Promise<void> {
  const phone = input.phone.trim()
  if (!phone) return

  const [existing] = await db
    .select({ id: customer.id, name: customer.name })
    .from(customer)
    .where(and(eq(customer.workspaceId, input.workspaceId), eq(customer.phone, phone)))
    .limit(1)

  if (existing) {
    await db
      .update(customer)
      .set({
        // A name the caller actually gave is worth more than a blank field,
        // but never overwrites one a client already entered.
        name: existing.name ?? input.name ?? undefined,
        lastCallAt: input.when,
        updatedAt: input.when,
      })
      .where(eq(customer.id, existing.id))
    return
  }

  await db.insert(customer).values({
    id: `cust_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    workspaceId: input.workspaceId,
    phone,
    name: input.name,
    status: 'lead',
    source: 'call',
    lastCallAt: input.when,
    createdAt: input.when,
    updatedAt: input.when,
  })
}
