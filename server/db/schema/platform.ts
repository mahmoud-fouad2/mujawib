import { boolean, index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Platform-wide contact channels — the email and phone the marketing site,
 * the Organization schema, and the legal pages show to a stranger.
 *
 * Singleton row (`id = 'default'`). Every value ships with `*Confirmed:
 * false` — see the seed migration — because the address and number this
 * table was created with (hello@mujawib.com, a placeholder phone) were never
 * verified: nobody had confirmed the domain receives mail there, or that the
 * number is provisioned and reachable on WhatsApp. A published channel nobody
 * answers costs more trust than no channel at all, so every reader of this
 * table (lib/data/platform.ts) must treat an unconfirmed channel as absent —
 * a safe placeholder, or hidden entirely — never as a live one.
 *
 * Edited from /console/system, owner-only, because a wrong value here is
 * customer-facing on every page rather than scoped to one workspace.
 */
export const platformContact = pgTable('platform_contact', {
  id: text('id').primaryKey(),
  email: text('email'),
  emailConfirmed: boolean('email_confirmed').notNull().default(false),
  phoneE164: text('phone_e164'),
  phoneDisplay: text('phone_display'),
  phoneConfirmed: boolean('phone_confirmed').notNull().default(false),
  whatsappEnabled: boolean('whatsapp_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedById: text('updated_by_id'),
})

export const siteEventTypeEnum = pgEnum('site_event_type', ['page_view', 'cta_click'])

/**
 * Self-hosted marketing-site analytics (audit report H5) — deliberately not
 * a third-party tool: no account for this session to create, and one fewer
 * script/cookie on a site whose own security page promises visitor privacy.
 * No IP, no user agent, no cookie, no visitor identifier of any kind —
 * these rows answer "what got traffic" in aggregate, never "who visited".
 */
export const siteEvent = pgTable(
  'site_event',
  {
    id: text('id').primaryKey(),
    type: siteEventTypeEnum('type').notNull(),
    path: text('path').notNull(),
    /** Set only for type = 'cta_click', e.g. 'book_consultation'. */
    ctaId: text('cta_id'),
    locale: text('locale').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('site_event_type_created_idx').on(t.type, t.createdAt),
    index('site_event_path_idx').on(t.path),
  ],
)
