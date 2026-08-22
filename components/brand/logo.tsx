import Image from 'next/image'

/**
 * The official lockup. Theme-aware variants are deterministically rebuilt from
 * the supplied high-resolution artwork; CSS selects ink or paper while the
 * isolated voice bars retain the single cool-blue brand signal.
 */

const LOCKUP = '/images/brand/logo-horizontal-hq.png'
const MARK = '/images/brand/logo-mark.png'

const LOCKUP_RATIO = 1319 / 382
const HEIGHTS = { sm: 24, md: 30, lg: 38, xl: 48 } as const

export type LogoSize = keyof typeof HEIGHTS

export function Logo({
  size = 'md',
  priority = false,
  className,
}: {
  size?: LogoSize
  priority?: boolean
  className?: string
}) {
  const height = HEIGHTS[size]
  const width = Math.round(height * LOCKUP_RATIO)

  return (
    <Image
      src={LOCKUP}
      alt="مُجاوِب MUJAWIB"
      width={width}
      height={height}
      priority={priority}
      className={['brand-logo', className].filter(Boolean).join(' ')}
      style={{ height, width: 'auto' }}
    />
  )
}

/** Square mark, for the collapsed sidebar and small surfaces. */
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
      src={MARK}
      alt="مُجاوِب"
      width={size}
      height={size}
      priority={priority}
      className={['brand-mark', className].filter(Boolean).join(' ')}
    />
  )
}
