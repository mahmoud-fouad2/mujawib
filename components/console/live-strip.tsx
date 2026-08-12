import { Label, Stack, Text } from '@primer/react'
import { DotFillIcon } from '@primer/octicons-react'
import { Waveform } from '@/components/waveform'

type LiveCall = {
  name: string
  initial: string
  phone: string
  duration: string
  status: string
  tone: 'success' | 'attention' | 'accent'
}

const CALLS: LiveCall[] = [
  {
    name: 'أحمد المالكي',
    initial: 'أ',
    phone: '+966 54 112 2334',
    duration: '00:48',
    status: 'جاري التحقق',
    tone: 'accent',
  },
  {
    name: 'نورة القحطاني',
    initial: 'ن',
    phone: '+966 53 246 8101',
    duration: '01:24',
    status: 'في الانتظار',
    tone: 'attention',
  },
  {
    name: 'خالد الشمري',
    initial: 'خ',
    phone: '+966 55 987 6543',
    duration: '02:11',
    status: 'جاري التحدث',
    tone: 'success',
  },
]

export function LiveStrip() {
  return (
    <div
      style={{
        borderRadius: 'var(--borderRadius-large)',
        background: 'var(--bgColor-emphasis)',
        border: '1px solid var(--borderColor-default)',
        padding: 18,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInlineStart: '-6%',
          top: '-80%',
          width: 360,
          height: 360,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--bgColor-accent-emphasis) 34%, transparent) 0%, transparent 66%)',
          filter: 'blur(10px)',
        }}
      />
      <Stack direction="horizontal" align="center" justify="space-between" style={{ position: 'relative' }}>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'color-mix(in srgb, var(--fgColor-onEmphasis) 70%, transparent)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          عرض الكل
        </button>
        <Stack direction="horizontal" align="center" gap="condensed">
          <Text weight="semibold" size="medium" style={{ color: 'var(--fgColor-onEmphasis)' }}>
            المكالمات المباشرة الآن
          </Text>
          <span
            className="mjw-pulse-dot"
            style={{ color: 'var(--fgColor-success)', display: 'inline-flex', animation: 'mjw-pulse 1.4s ease-in-out infinite' }}
          >
            <DotFillIcon size={14} />
          </span>
          <Text size="small" style={{ color: 'var(--fgColor-success)' }}>
            مباشر
          </Text>
        </Stack>
      </Stack>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          position: 'relative',
        }}
      >
        {CALLS.map((c) => (
          <div
            key={c.phone}
            style={{
              borderRadius: 'var(--borderRadius-medium)',
              border: '1px solid color-mix(in srgb, var(--fgColor-onEmphasis) 12%, transparent)',
              background: 'color-mix(in srgb, var(--fgColor-onEmphasis) 5%, transparent)',
              padding: 12,
            }}
          >
            <Stack direction="horizontal" align="center" justify="space-between">
              <Stack direction="horizontal" align="center" gap="condensed">
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bgColor-accent-emphasis)',
                    color: 'var(--fgColor-onEmphasis)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {c.initial}
                </span>
                <Stack direction="vertical" gap="none">
                  <Text size="small" weight="semibold" style={{ color: 'var(--fgColor-onEmphasis)' }}>
                    {c.name}
                  </Text>
                  <Text
                    className="mjw-tabular"
                    size="small"
                    style={{ color: 'color-mix(in srgb, var(--fgColor-onEmphasis) 55%, transparent)' }}
                  >
                    {c.phone}
                  </Text>
                </Stack>
              </Stack>
              <Text
                className="mjw-tabular"
                size="small"
                style={{ color: 'color-mix(in srgb, var(--fgColor-onEmphasis) 70%, transparent)' }}
              >
                {c.duration}
              </Text>
            </Stack>
            <Stack direction="horizontal" align="center" justify="space-between" style={{ marginTop: 10 }}>
              <Label variant={c.tone}>{c.status}</Label>
              <Waveform bars={14} height={20} live color="color-mix(in srgb, var(--fgColor-onEmphasis) 55%, transparent)" />
            </Stack>
          </div>
        ))}
      </div>
    </div>
  )
}
