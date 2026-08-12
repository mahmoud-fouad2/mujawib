import type { CSSProperties, ReactNode } from 'react'

type SurfaceProps = {
  children: ReactNode
  elevated?: boolean
  inset?: boolean
  radius?: 'medium' | 'large' | 'xhero'
  padding?: number | string
  interactive?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * Token-styled padded surface — the generic card primitive for the app.
 * All color/radius/shadow values come from Primer primitives.
 */
export function Surface({
  children,
  elevated,
  inset,
  radius = 'large',
  padding = 20,
  interactive,
  style,
  className,
}: SurfaceProps) {
  const radiusToken =
    radius === 'xhero'
      ? '22px'
      : radius === 'large'
        ? 'var(--borderRadius-large)'
        : 'var(--borderRadius-medium)'
  return (
    <div
      className={[interactive ? 'mjw-surface-interactive' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundColor: inset ? 'var(--bgColor-inset)' : 'var(--bgColor-default)',
        border: '1px solid var(--borderColor-muted)',
        borderRadius: radiusToken,
        boxShadow: elevated ? 'var(--shadow-resting-medium)' : 'var(--shadow-resting-xsmall)',
        padding,
        transition: interactive ? 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
