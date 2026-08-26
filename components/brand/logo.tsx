import Image from 'next/image'

/**
 * The official lockup. Theme-aware variants are deterministically rebuilt from
 * the supplied high-resolution artwork; CSS selects ink or paper while the
 * isolated voice bars retain the single cool-blue brand signal.
 *
 * The Arabic lockup (icon + مُجاوِب + small MUJAWIB caption) is the default,
 * used everywhere: console, portal, auth screens, and the /ar marketing site.
 * `locale="en"` swaps in the English-only lockup (icon + MUJAWIB, no Arabic
 * script) — the only place that needs it is the marketing header and footer
 * on /en pages, so it is opt-in rather than threaded through every caller.
 */

const LOCKUP_RATIO = { ar: 1243 / 292, en: 1250 / 270 } as const
const HEIGHTS = { sm: 24, md: 30, lg: 38, xl: 48 } as const

export type LogoSize = keyof typeof HEIGHTS
export type LogoLocale = 'ar' | 'en'

export function Logo({
  size = 'md',
  locale = 'ar',
  priority = false,
  className,
}: {
  size?: LogoSize
  locale?: LogoLocale
  priority?: boolean
  className?: string
}) {
  const height = HEIGHTS[size]
  const width = Math.round(height * LOCKUP_RATIO[locale])
  // The default (unsuffixed) files carry the Arabic lockup; only the English
  // one needs a modifier, matching the CSS content-swap rules in base.css.
  const lockupSrc =
    locale === 'en'
      ? '/images/brand/logo-horizontal-en-ink.png'
      : '/images/brand/logo-horizontal-ink.png'

  return (
    <Image
      src={lockupSrc}
      alt={locale === 'en' ? 'MUJAWIB' : 'مُجاوِب MUJAWIB'}
      width={width}
      height={height}
      priority={priority}
      className={['brand-logo', locale === 'en' && 'brand-logo--en', className]
        .filter(Boolean)
        .join(' ')}
      style={{ height, width: 'auto' }}
    />
  )
}

/** Square mark, for the collapsed sidebar and small surfaces. No text — same in every locale. */
export function LogoMark({
  size = 28,
  priority = false,
  className,
}: {
  size?: number
  priority?: boolean
  className?: string
}) {
  return (
    <Image
      src="/images/brand/logo-mark-ink.png"
      alt="مُجاوِب"
      width={size}
      height={size}
      priority={priority}
      className={['brand-mark', className].filter(Boolean).join(' ')}
    />
  )
}
