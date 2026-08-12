import { Label, Stack, Text } from '@primer/react'
import { GraphIcon, ShieldCheckIcon } from '@primer/octicons-react'
import { Surface } from '@/components/surface'
import { Sparkline } from '@/components/sparkline'

const QA_TREND = [62, 68, 66, 74, 71, 80, 78, 86, 84, 91, 94]

const FLAGS: { label: string; count: number; variant: 'attention' | 'severe' | 'danger' }[] = [
  { label: 'معلومات غير دقيقة', count: 2, variant: 'attention' },
  { label: 'تأخير في الرد', count: 3, variant: 'severe' },
  { label: 'نبرة غير مناسبة', count: 1, variant: 'danger' },
]

export function QaPanel() {
  return (
    <Surface padding={20} elevated>
      <Stack direction="vertical" gap="normal">
        <Stack direction="horizontal" align="center" justify="space-between">
          <span style={{ color: 'var(--fgColor-accent)', display: 'inline-flex' }}>
            <ShieldCheckIcon size={18} />
          </span>
          <Text weight="semibold" size="large">
            الجودة (QA)
          </Text>
        </Stack>

        <Stack direction="horizontal" align="baseline" gap="condensed">
          <Label variant="success">ممتاز</Label>
          <Text size="small" style={{ color: 'var(--fgColor-muted)' }} className="mjw-tabular">
            / 100
          </Text>
          <Text className="mjw-tabular" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
            94
          </Text>
        </Stack>

        <div
          style={{
            background: 'var(--bgColor-inset)',
            borderRadius: 'var(--borderRadius-medium)',
            padding: 14,
          }}
        >
          <div className="mjw-fluid-svg">
            <Sparkline data={QA_TREND} width={520} height={90} strokeWidth={2.25} />
          </div>
          <Stack direction="horizontal" justify="space-between" style={{ marginTop: 6 }}>
            {['18 مايو', '16 مايو', '14 مايو', '12 مايو'].map((d) => (
              <Text key={d} size="small" style={{ color: 'var(--fgColor-muted)' }}>
                {d}
              </Text>
            ))}
          </Stack>
        </div>

        <Stack direction="vertical" gap="condensed">
          <Text size="small" weight="semibold">
            أبرز الملاحظات
          </Text>
          <Stack direction="horizontal" gap="condensed" wrap="wrap">
            {FLAGS.map((f) => (
              <div
                key={f.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 'var(--borderRadius-medium)',
                  border: '1px solid var(--borderColor-muted)',
                  background: 'var(--bgColor-muted)',
                }}
              >
                <Label variant={f.variant}>{f.count}</Label>
                <Text size="small">{f.label}</Text>
              </div>
            ))}
          </Stack>
        </Stack>

        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--fgColor-accent)',
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <GraphIcon size={14} />
          عرض تقرير الجودة الكامل
        </button>
      </Stack>
    </Surface>
  )
}
