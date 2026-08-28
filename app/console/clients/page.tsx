import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ClientRowActions } from '@/components/console/client-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { type ClientBusinessInfo, clientEditable } from '@/lib/client-editable'
import { num, relative, WORKSPACE_STATUS_LABEL, workspaceTone } from '@/lib/format'
import { requireOperatorPage } from '@/server/auth/access'
import { getClients } from '@/server/data/console'

export const metadata: Metadata = { title: 'العملاء' }
export const dynamic = 'force-dynamic'

const PACK_LABEL: Record<string, string> = {
  medical: 'العيادات',
  realestate: 'العقارات',
  auto: 'خدمات السيارات',
  reception: 'خدمة العملاء',
}

export default async function ClientsPage() {
  const [clients, access] = await Promise.all([
    getClients(),
    requireOperatorPage('/console/clients'),
  ])
  // Permanent deletion is the owner's alone; everyone else sees it disabled
  // with the reason rather than not at all.
  const canDelete = access.role === 'owner'
  const live = clients.filter((c) => c.status === 'live').length
  const calls30d = clients.reduce((s, c) => s + c.calls30d, 0)
  const bookings30d = clients.reduce((s, c) => s + c.bookings30d, 0)
  const unhealthy = clients.filter((c) => c.unhealthy > 0).length

  return (
    <>
      <PageHead
        title="العملاء"
        sub="الشركات المشغَّلة على المنصة وحالة كل واحدة"
        actions={
          <Link href="/onboarding" className="btn btn--primary btn--sm">
            <Plus size={15} aria-hidden="true" />
            عميل جديد
          </Link>
        }
      />

      <SummaryBar
        items={[
          { label: `عميل نشط من ${num(clients.length)}`, value: num(live), tone: 'good' },
          { label: 'مكالمة خلال 30 يومًا', value: num(calls30d) },
          { label: 'حجز خلال 30 يومًا', value: num(bookings30d) },
          ...(unhealthy
            ? [{ label: 'لديه ربط متعثر', value: num(unhealthy), tone: 'warn' as const }]
            : []),
        ]}
      />

      <Section title="كل العملاء" flush>
        {clients.length === 0 ? (
          <EmptyState
            title="لا عملاء بعد"
            body="أضف أول عميل من زر «عميل جديد» أعلاه ليبدأ إعداد الموظف الصوتي له."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الشركة</th>
                  <th>الحالة</th>
                  <th>القطاع</th>
                  <th>المدينة</th>
                  <th>مكالمات 30 يومًا</th>
                  <th>حجوزات</th>
                  <th>موظفون</th>
                  <th>الربط</th>
                  <th>منذ</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const info = (c.businessInfo ?? {}) as ClientBusinessInfo
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/console/clients/${c.slug}`}>{c.name}</Link>
                      </td>
                      <td>
                        <Pill tone={workspaceTone(c.status)}>
                          {WORKSPACE_STATUS_LABEL[c.status] ?? c.status}
                        </Pill>
                      </td>
                      <td className="muted">
                        {c.industryPack ? (PACK_LABEL[c.industryPack] ?? c.industryPack) : '—'}
                      </td>
                      <td className="muted">{info.city ?? '—'}</td>
                      <td className="mono">{num(c.calls30d)}</td>
                      <td className="mono">{num(c.bookings30d)}</td>
                      <td className="mono">{num(c.agents)}</td>
                      <td>
                        {c.unhealthy > 0 ? (
                          <Pill tone="bad">{num(c.unhealthy)} متعثر</Pill>
                        ) : (
                          <Pill tone="good">سليم</Pill>
                        )}
                      </td>
                      <td className="muted">{relative(c.createdAt)}</td>
                      <td>
                        <ClientRowActions client={clientEditable(c, info)} canDelete={canDelete} />
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
