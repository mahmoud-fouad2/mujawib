'use client'

type WaveformProps = {
  bars?: number
  height?: number
  live?: boolean
  color?: string
  className?: string
}

/**
 * Purposeful live-motion equalizer. Bars animate only when `live` is true —
 * matching the product principle of "Live Motion with Purpose". Colors come
 * from Primer tokens via currentColor / the `color` token prop.
 */
export function Waveform({
  bars = 28,
  height = 32,
  live = true,
  color = 'var(--fgColor-accent)',
  className,
}: WaveformProps) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        height,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const seed = (Math.sin(i * 1.7) + 1) / 2
        const base = 0.28 + seed * 0.62
        return (
          <span
            key={i}
            className={live ? 'mjw-eq-bar' : undefined}
            style={{
              display: 'block',
              width: 3,
              height: '100%',
              borderRadius: 'var(--borderRadius-full)',
              background: color,
              opacity: live ? 1 : 0.4,
              transformOrigin: 'center',
              transform: `scaleY(${base})`,
              animation: live
                ? `mjw-eq ${0.7 + seed * 0.9}s ease-in-out ${i * 0.04}s infinite`
                : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
