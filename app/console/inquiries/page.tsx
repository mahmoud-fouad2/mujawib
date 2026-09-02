import type { Metadata } from 'next'
import Link from 'next/link'
import { InquiryActions } from '@/components/console/inquiry-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { getSalesInquiries, getSalesInquiryCounts } from '@/server/data/console'

export const metadata: Metadata = { title: 'طلبات العروض' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; tone: 'neutral' | 'signal' | 'good' | 'warn' }> = {
  new: { label: 'جديد', tone: 'signal' },
  qualified: { label: 'مؤهل', tone: 'good' },
  proposal: { label: 'عُرضت الخطة', tone: 'warn' },
  won: { label: 'تحول إلى عميل', tone: 'good' },
  lost: { label: 'لم يستمر', tone: 'neutral' },
}

/**
 * The two meta-views sit first because they are what Ops opens this page for:
 * what still needs work, and what nobody has picked up. The lifecycle values
 * follow in the order a deal moves through them.
 */
const FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'open', label: 'مفتوح' },
  { value: 'unowned', label: 'بلا مالك' },
  { value: 'new', label: 'جديد' },
  { value: 'qualified', label: 'مؤهل' },
  { value: 'proposal', label: 'عُرضت الخطة' },
  { value: 'won', label: 'تحول إلى عميل' },
  { value: 'lost', label: 'لم يستمر' },
] as const

function countFor(
  value: string,
  counts: Awaited<ReturnType<typeof getSalesInquiryCounts>>,
): number {
  if (value === '') return counts.total
  if (value === 'open') return counts.open
  if (value === 'unowned') return counts.unowned
  return counts.byStatus[value] ?? 0
}

function hrefFor(status: string, search: string) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search) params.set('q', search)
  const query = params.toString()
  return query ? `/console/inquiries?${query}` : '/console/inquiries'
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const status = FILTERS.some((f) => f.value === params.status) ? (params.status ?? '') : ''
  const search = params.q?.trim() ?? ''

  const [inquiries, counts] = await Promise.all([
    getSalesInquiries({ ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    getSalesInquiryCounts(),
  ])

  return (
    <>
      <PageHead title="طلبات العروض" sub="كل طلب من الموقع، من الاستلام حتى التحويل إلى عميل" />
      <SummaryBar
        items={[
          { label: 'طلب مفتوح', value: num(counts.open) },
          {
            label: 'ينتظر مالكًا',
            value: num(counts.unowned),
            ...(counts.unowned ? { tone: 'warn' as const } : {}),
          },
          {
            label: 'تحول إلى عميل',
            value: num(counts.byStatus.won ?? 0),
            tone: 'good',
          },
        ]}
      />
      <Section title="الطلبات" meta={`${num(inquiries.length)} معروض`} flush>
        {/*
          Server-rendered links rather than a client filter component: the
          filtering happens in SQL, so the URL is the state and a filtered
          view is something an operator can bookmark or send to a colleague.
        */}
        <div className="console-table-toolbar">
          <form action="/console/inquiries" className="console-table-toolbar__search">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input
              type="search"
              name="q"
              className="input"
              defaultValue={search}
              placeholder="بحث بالشركة أو الاسم أو البريد"
              aria-label="بحث في الطلبات"
            />
          </form>
          {FILTERS.map((filter) => (
            <Link
              key={filter.value || 'all'}
              href={hrefFor(filter.value, search)}
              className="filter-chip"
              aria-pressed={status === filter.value}
            >
              {filter.label} ({num(countFor(filter.value, counts))})
            </Link>
          ))}
        </div>

        {inquiries.length === 0 ? (
          <EmptyState
            title={status || search ? 'لا نتائج' : 'لا طلبات بعد'}
            body={
              status || search
                ? 'جرّب فلترًا آخر أو امسح البحث.'
                : 'ستظهر هنا الطلبات المرسلة من صفحة التواصل.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
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
                  const tone = STATUS[item.status] ?? {
                    label: item.status,
                    tone: 'neutral' as const,
                  }
                  return (
                    <tr key={item.id}>
                      <td data-label="الشركة">
                        <strong>{item.company}</strong>
                        <div className="muted mono">{item.email}</div>
                      </td>
                      <td data-label="جهة الاتصال">
                        {item.name}
                        <div className="muted mono">{item.phone || '—'}</div>
                      </td>
                      <td data-label="الاحتياج" className="inquiry-need">
                        {item.need}
                      </td>
                      <td data-label="الحجم" className="mono">
                        {item.monthlyCalls ?? '—'}
                      </td>
                      <td data-label="الحالة">
                        <Pill tone={tone.tone}>{tone.label}</Pill>
                      </td>
                      <td data-label="وصل" className="muted">
                        {relative(item.createdAt)}
                      </td>
                      <td data-label="إجراءات">
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
