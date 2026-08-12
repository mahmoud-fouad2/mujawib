'use client'

import { Avatar, Label, Stack, Text } from '@primer/react'
import { DataTable } from '@primer/react/experimental'
import { CalendarIcon, CheckCircleIcon, PeopleIcon } from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { Surface } from '@/components/surface'

type Outcome = 'resolved' | 'booked' | 'transfer'

type Row = {
  id: number
  customer: string
  phone: string
  agent: string
  avatar: string
  duration: string
  time: string
  outcome: Outcome
}

const OUTCOME_META: Record<Outcome, { label: string; variant: 'success' | 'done' | 'attention'; icon: Icon }> = {
  resolved: { label: 'تم الحل', variant: 'success', icon: CheckCircleIcon },
  booked: { label: 'تم الحجز', variant: 'done', icon: CalendarIcon },
  transfer: { label: 'تحويل لموظف', variant: 'attention', icon: PeopleIcon },
}

const ROWS: Row[] = [
  { id: 1, customer: 'سارة', phone: '+966 50 123 4567', agent: 'مُجاوِب - أمل', avatar: '/console/agent-1.png', duration: '04:32', time: 'اليوم، 10:24 ص', outcome: 'resolved' },
  { id: 2, customer: 'خالد', phone: '+966 55 987 6543', agent: 'مُجاوِب - نايف', avatar: '/console/agent-2.png', duration: '06:18', time: 'اليوم، 10:18 ص', outcome: 'booked' },
  { id: 3, customer: 'نورة', phone: '+966 53 246 8101', agent: 'مُجاوِب - سارة', avatar: '/console/agent-3.png', duration: '03:57', time: 'اليوم، 10:12 ص', outcome: 'transfer' },
  { id: 4, customer: 'أحمد', phone: '+966 54 112 2334', agent: 'مُجاوِب - أمل', avatar: '/console/agent-1.png', duration: '02:11', time: 'اليوم، 10:08 ص', outcome: 'resolved' },
  { id: 5, customer: 'منال', phone: '+966 56 778 8990', agent: 'مُجاوِب - نايف', avatar: '/console/agent-2.png', duration: '05:09', time: 'اليوم، 10:03 ص', outcome: 'booked' },
]

export function RecentCalls() {
  return (
    <Surface padding={0} elevated style={{ overflow: 'hidden' }}>
      <Stack
        direction="horizontal"
        align="center"
        justify="space-between"
        padding="normal"
        style={{ borderBottom: '1px solid var(--borderColor-muted)' }}
      >
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: 'var(--fgColor-accent)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          عرض الكل
        </button>
        <Text weight="semibold" size="large">
          آخر المكالمات
        </Text>
      </Stack>
      <div style={{ padding: '4px 8px 8px' }}>
        <DataTable
          aria-label="آخر المكالمات"
          data={ROWS}
          cellPadding="normal"
          columns={[
            {
              header: 'العميل',
              field: 'customer',
              rowHeader: true,
              renderCell: (row) => (
                <Stack direction="vertical" gap="none">
                  <Text size="small" weight="semibold">
                    {row.customer}
                  </Text>
                  <Text className="mjw-tabular" size="small" style={{ color: 'var(--fgColor-muted)' }}>
                    {row.phone}
                  </Text>
                </Stack>
              ),
            },
            {
              header: 'الوكيل',
              field: 'agent',
              renderCell: (row) => (
                <Stack direction="horizontal" gap="condensed" align="center">
                  <Avatar src={row.avatar} size={22} alt="" />
                  <Text size="small">{row.agent}</Text>
                </Stack>
              ),
            },
            {
              header: 'النتيجة',
              field: 'outcome',
              renderCell: (row) => {
                const meta = OUTCOME_META[row.outcome]
                return <Label variant={meta.variant}>{meta.label}</Label>
              },
            },
            {
              header: 'المدة',
              field: 'duration',
              renderCell: (row) => (
                <Text className="mjw-tabular" size="small" style={{ color: 'var(--fgColor-muted)' }}>
                  {row.duration}
                </Text>
              ),
            },
            {
              header: 'الوقت',
              field: 'time',
              renderCell: (row) => (
                <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
                  {row.time}
                </Text>
              ),
            },
          ]}
        />
      </div>
    </Surface>
  )
}
