import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
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
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
