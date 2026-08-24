import { MessageSquare, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { clock, fullDate, maskPhone, num } from '@/lib/format'
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

      <Section title="كل الحجوزات" flush>
        {bookings.length === 0 ? (
          <EmptyState
            title="لا حجوزات بعد"
            body="عندما ينجز مُجاوِب حجزًا داخل تقويمك سيظهر هنا بتفاصيله الكاملة."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الجوال</th>
                  <th>الخدمة</th>
                  <th>الموعد</th>
                  <th>الوقت</th>
                  <th>الفرع</th>
                  <th>الحالة</th>
                  <th>تواصل سريع</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const meta = (b.metadata ?? {}) as { branch?: string }
                  const cleanPhone = b.customerPhone ? b.customerPhone.replace(/\D/g, '') : ''
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.customerName ?? '—'}</td>
                      <td className="mono">{maskPhone(b.customerPhone)}</td>
                      <td className="muted">{b.service ?? '—'}</td>
                      <td className="muted">{fullDate(b.scheduledAt)}</td>
                      <td className="mono">{clock(b.scheduledAt)}</td>
                      <td className="muted">{meta.branch ?? '—'}</td>
                      <td>
                        <Pill tone={b.status === 'confirmed' ? 'good' : 'bad'}>
                          {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                        </Pill>
                      </td>
                      <td>
                        <span className="row" style={{ gap: 'var(--s-1)' }}>
                          {cleanPhone ? (
                            <>
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn--quiet btn--sm"
                                title="مراسلة عبر واتساب"
                                aria-label="واتساب"
                              >
                                <MessageSquare size={14} aria-hidden="true" />
                              </a>
                              <a
                                href={`tel:${b.customerPhone}`}
                                className="btn btn--quiet btn--sm"
                                title="اتصال مباشر"
                                aria-label="اتصال"
                              >
                                <Phone size={14} aria-hidden="true" />
                              </a>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
