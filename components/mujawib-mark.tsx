import { Stack, Text } from '@primer/react'

type MarkProps = {
  size?: number
  showWordmark?: boolean
  onEmphasis?: boolean
}

/**
 * MUJAWIB brand lockup: a compact voice-bars glyph + bilingual wordmark.
 * Uses currentColor / Primer tokens so it adapts to light & dark modes.
 */
export function MujawibMark({ size = 22, showWordmark = true, onEmphasis }: MarkProps) {
  const fg = onEmphasis ? 'var(--fgColor-onEmphasis)' : 'var(--fgColor-default)'
  const heights = [0.5, 0.85, 0.35, 1, 0.6]
  return (
    <Stack direction="horizontal" gap="condensed" align="center">
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: size,
        }}
      >
        {heights.map((h, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: Math.max(2, size * 0.13),
              height: `${h * 100}%`,
              borderRadius: 'var(--borderRadius-full)',
              background:
                i === 3 ? 'var(--fgColor-accent)' : fg,
            }}
          />
        ))}
      </div>
      {showWordmark ? (
        <Stack direction="vertical" gap="none">
          <Text
            style={{
              fontFamily: 'var(--font-cairo), sans-serif',
              fontWeight: 800,
              fontSize: size * 0.82,
              lineHeight: 1,
              letterSpacing: '0.01em',
              color: fg,
            }}
          >
            مُجاوِب
          </Text>
          <Text
            style={{
              fontWeight: 600,
              fontSize: size * 0.42,
              lineHeight: 1.2,
              letterSpacing: '0.18em',
              color: onEmphasis ? 'var(--fgColor-onEmphasis)' : 'var(--fgColor-muted)',
              direction: 'ltr',
            }}
          >
            MUJAWIB
          </Text>
        </Stack>
      ) : null}
    </Stack>
  )
}
