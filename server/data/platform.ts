import 'server-only'

import { cache } from 'react'
import { db } from '@/server/db'
import { platformContact } from '@/server/db/schema'

export type PlatformContact = {
  /** Null unless an operator has confirmed the address actually receives mail. */
  email: string | null
  /** Null unless an operator has confirmed the number is provisioned and answered. */
  phone: { e164: string; display: string } | null
  /** Only set when the phone is confirmed AND WhatsApp is confirmed reachable on it. */
  whatsappUrl: string | null
}

/**
 * The channels the site is allowed to present as real, right now.
 *
 * Deliberately returns `null` rather than a stored-but-unconfirmed value —
 * every caller (footer, Organization schema, legal pages) must fall back to
 * something that does not claim a channel exists until this says it does.
 * `cache()` dedupes this across one request, so the footer and the page body
 * asking in the same render cost one query, not two.
 */
/**
 * The raw row, unconfirmed values included — for the console edit form only.
 * `getPlatformContact` below hides exactly what this exposes on purpose; an
 * operator editing the settings needs to see the actual current draft, not
 * the public-safe view of it.
 */
export async function getPlatformContactDraft() {
  const [row] = await db
    .select()
    .from(platformContact)
    .limit(1)
    .catch(() => [])
  return {
    email: row?.email ?? '',
    emailConfirmed: row?.emailConfirmed ?? false,
    phoneE164: row?.phoneE164 ?? '',
    phoneDisplay: row?.phoneDisplay ?? '',
    phoneConfirmed: row?.phoneConfirmed ?? false,
    whatsappEnabled: row?.whatsappEnabled ?? false,
  }
}

export const getPlatformContact = cache(async (): Promise<PlatformContact> => {
  // Singleton table — one row, no predicate needed.
  const [row] = await db
    .select()
    .from(platformContact)
    .limit(1)
    .catch(() => [])

  return {
    email: row?.emailConfirmed && row.email ? row.email : null,
    phone:
      row?.phoneConfirmed && row.phoneE164 && row.phoneDisplay
        ? { e164: row.phoneE164, display: row.phoneDisplay }
        : null,
    whatsappUrl:
      row?.phoneConfirmed && row.whatsappEnabled && row.phoneE164
        ? `https://wa.me/${row.phoneE164.replace('+', '')}`
        : null,
  }
})
