import { MessageSquare, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { maskPhone, num, relative } from '@/lib/format'
import { getPortalCustomers, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'العملاء' }
export const dynamic = 'force-dynamic'

export default async function PortalCustomersPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const customers = await getPortalCustomers(workspace.id, 60)

  return (
    <>
      <PageHead title="المتصلون" sub="من اتصل بك، وكم مرة، وما الذي أنجزه في كل مرة" />

      <Section title="قائمة المتصلين" meta={`${num(customers.length)} متصل`} flush>
        {customers.length === 0 ? (
          <EmptyState
            title="لا متصلين مسجلين بعد"
            body="عندما يستقبل مُجاوِب مكالمات منشأتك ستظهر بيانات المتصلين وتكرار زياراتهم هنا تلقائيًا."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>المكالمات</th>
                  <th>الحجوزات</th>
                  <th>الوسوم</th>
                  <th>آخر اتصال</th>
                  <th>تواصل سريع</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : ''
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name ?? '—'}</td>
                      <td className="mono">{maskPhone(c.phone)}</td>
                      <td className="mono">{num(c.calls)}</td>
                      <td className="mono">{num(c.bookings)}</td>
                      <td>
                        <span className="queue__flags">
                          {(c.tags ?? []).map((t) => (
                            <Pill key={t} tone="signal">
                              {t}
                            </Pill>
                          ))}
                        </span>
                      </td>
                      <td className="muted">{relative(c.lastCallAt)}</td>
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
                                href={`tel:${c.phone}`}
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
