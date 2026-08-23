/**
 * The one place the company's contact details live.
 *
 * They were repeated across the footer copy, the contact page, both privacy
 * pages and the Organization schema — six literals that had already drifted:
 * the site advertises `@mujawib.com` while `.env.example` sends account mail
 * from `@mujawib.ai`, and neither domain resolves today. Whichever is right,
 * it is now one edit rather than six.
 *
 * NEEDS BUSINESS CONFIRMATION before the site leaves the onrender.com host:
 *   - which domain is the real one, and whether EMAIL receives mail there
 *   - whether PHONE is a provisioned number, and whether WhatsApp is on it
 * A published channel that does not answer costs more than no channel at all.
 *
 * The public URL is deliberately not here: everything canonical derives from
 * NEXT_PUBLIC_APP_URL, so pointing the site at a custom domain is a change of
 * environment variable and DNS, with no code to touch.
 */
export const CONTACT = {
  email: 'hello@mujawib.com',
  /** E.164, for `tel:` and `wa.me`. */
  phoneE164: '+966920012130',
  /** Grouped for reading; the link strips the spaces. */
  phoneDisplay: '+966 920 012 130',
} as const

export const CONTACT_WHATSAPP_URL = `https://wa.me/${CONTACT.phoneE164.replace('+', '')}`
