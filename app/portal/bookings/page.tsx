import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { PortalBookingsExperience } from '@/components/portal/bookings-experience'
import { num } from '@/lib/format'
import { getPortalBookings, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'الحجوزات' }
export const dynamic = 'force-dynamic'

export default async function PortalBookingsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const bookings = await getPortalBookings(workspace.id, 60)
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length
  const upcoming = bookings.filter(
    (b) => b.scheduledAt && new Date(b.scheduledAt).getTime() > Date.now(),
  ).length

  return (
    <>
      <PageHead title="الحجوزات" sub="الحجوزات التي أنجزها الصوت داخل تقويمك" />

      <SummaryBar
        items={[
          { label: 'حجز', value: num(bookings.length) },
          { label: 'مؤكد', value: num(confirmed), tone: 'good' },
          { label: 'قادم', value: num(upcoming) },
          ...(cancelled ? [{ label: 'ملغى', value: num(cancelled), tone: 'bad' as const }] : []),
        ]}
      />

      <Section title="إدارة وسجل الحجوزات" meta={`${num(bookings.length)} حجز`} flush>
        <PortalBookingsExperience rows={bookings} />
      </Section>
    </>
  )
}
