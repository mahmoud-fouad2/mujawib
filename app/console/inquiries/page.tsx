import type { Metadata } from 'next'
import { InquiryActions } from '@/components/console/inquiry-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { getSalesInquiries } from '@/server/data/console'

export const metadata: Metadata = { title: 'طلبات العروض' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; tone: 'neutral' | 'signal' | 'good' | 'warn' }> = {
  new: { label: 'جديد', tone: 'signal' },
  qualified: { label: 'مؤهل', tone: 'good' },
  proposal: { label: 'عُرضت الخطة', tone: 'warn' },
  won: { label: 'تحول إلى عميل', tone: 'good' },
  lost: { label: 'لم يستمر', tone: 'neutral' },
}

export default async function InquiriesPage() {
  const inquiries = await getSalesInquiries()
  const open = inquiries.filter((item) => ['new', 'qualified', 'proposal'].includes(item.status))
  const unowned = open.filter((item) => !item.ownerId)

  return (
    <>
      <PageHead title="طلبات العروض" sub="كل طلب من الموقع، من الاستلام حتى التحويل إلى عميل" />
      <SummaryBar
        items={[
          { label: 'طلب مفتوح', value: num(open.length) },
          {
            label: 'ينتظر مالكًا',
            value: num(unowned.length),
            tone: unowned.length ? 'warn' : undefined,
          },
          {
            label: 'تحول إلى عميل',
            value: num(inquiries.filter((item) => item.status === 'won').length),
            tone: 'good',
          },
        ]}
      />
      <Section title="الطلبات" flush>
        {inquiries.length === 0 ? (
          <EmptyState title="لا طلبات بعد" body="ستظهر هنا الطلبات المرسلة من صفحة التواصل." />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الشركة</th>
                  <th>جهة الاتصال</th>
                  <th>الاحتياج</th>
                  <th>الحجم</th>
                  <th>الحالة</th>
                  <th>وصل</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {inquiries.map((item) => {
                  const status = STATUS[item.status] ?? {
                    label: item.status,
                    tone: 'neutral' as const,
                  }
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.company}</strong>
                        <div className="muted mono">{item.email}</div>
                      </td>
                      <td>
                        {item.name}
                        <div className="muted mono">{item.phone || '—'}</div>
                      </td>
                      <td className="inquiry-need">{item.need}</td>
                      <td className="mono">{item.monthlyCalls ?? '—'}</td>
                      <td>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </td>
                      <td className="muted">{relative(item.createdAt)}</td>
                      <td>
                        <InquiryActions inquiryId={item.id} status={item.status} />
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
