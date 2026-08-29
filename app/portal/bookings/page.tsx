import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { PortalBookingsExperience } from '@/components/portal/bookings-experience'
import { num } from '@/lib/format'
import { getPortalBookings, getPortalBookingsStats, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'الحجوزات' }
export const dynamic = 'force-dynamic'

export default async function PortalBookingsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const [bookings, stats] = await Promise.all([
    getPortalBookings(workspace.id, 60),
    getPortalBookingsStats(workspace.id),
  ])
  const meta =
    stats.total > bookings.length
      ? `${num(bookings.length)} من ${num(stats.total)} حجز`
      : `${num(stats.total)} حجز`

  return (
    <>
      <PageHead title="الحجوزات" sub="الحجوزات التي أنجزها الصوت داخل تقويمك" />

      <SummaryBar
        items={[
          { label: 'حجز', value: num(stats.total) },
          { label: 'مؤكد', value: num(stats.confirmed), tone: 'good' },
          { label: 'قادم', value: num(stats.upcoming) },
          ...(stats.cancelled
            ? [{ label: 'ملغى', value: num(stats.cancelled), tone: 'bad' as const }]
            : []),
        ]}
      />

      <Section title="إدارة وسجل الحجوزات" meta={meta} flush>
        <PortalBookingsExperience rows={bookings} />
      </Section>
    </>
  )
}
