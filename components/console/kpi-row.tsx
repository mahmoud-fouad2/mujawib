import { Heading, Stack, Text } from '@primer/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  PeopleIcon,
  UnmuteIcon,
} from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { Surface } from '@/components/surface'
import { Sparkline } from '@/components/sparkline'

type Kpi = {
  label: string
  value: string
  delta: string
  positive: boolean
  icon: Icon
  data: number[]
}

const KPIS: Kpi[] = [
  {
    label: 'المكالمات اليوم',
    value: '3,876',
    delta: '8.9% عن أمس',
    positive: true,
    icon: UnmuteIcon,
    data: [12, 18, 14, 22, 19, 26, 30],
  },
  {
    label: 'الحجوزات المؤكدة',
    value: '1,248',
    delta: '12.6% عن أمس',
    positive: true,
    icon: CalendarIcon,
    data: [10, 12, 16, 14, 20, 22, 27],
  },
  {
    label: 'معدل الحل',
    value: '82.3%',
    delta: '3.1% عن أمس',
    positive: true,
    icon: CheckCircleIcon,
    data: [16, 14, 18, 20, 19, 23, 25],
  },
  {
    label: 'التحويل إلى موظف',
    value: '18.7%',
    delta: '2.4% عن أمس',
    positive: false,
    icon: PeopleIcon,
    data: [22, 20, 24, 19, 21, 18, 17],
  },
]

export function KpiRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}
    >
      {KPIS.map((k) => {
        const IconComp = k.icon
        return (
          <Surface key={k.label} padding={18} interactive>
            <Stack direction="vertical" gap="normal">
              <Stack direction="horizontal" align="center" justify="space-between">
                <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
                  {k.label}
                </Text>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--borderRadius-medium)',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bgColor-accent-muted)',
                    color: 'var(--fgColor-accent)',
                  }}
                >
                  <IconComp size={17} />
                </span>
              </Stack>
              <Heading as="h3" className="mjw-tabular" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
                {k.value}
              </Heading>
              <Stack direction="horizontal" align="center" justify="space-between">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 9px 3px 7px',
                    borderRadius: 'var(--borderRadius-full)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: k.positive ? 'var(--fgColor-success)' : 'var(--fgColor-danger)',
                    background: k.positive
                      ? 'var(--bgColor-success-muted)'
                      : 'var(--bgColor-danger-muted)',
                  }}
                >
                  <span style={{ display: 'inline-flex' }}>
                    {k.positive ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
                  </span>
                  {k.delta}
                </span>
                <Sparkline
                  data={k.data}
                  width={70}
                  height={24}
                  stroke={k.positive ? 'var(--fgColor-success)' : 'var(--fgColor-danger)'}
                />
              </Stack>
            </Stack>
          </Surface>
        )
      })}
    </div>
  )
}
