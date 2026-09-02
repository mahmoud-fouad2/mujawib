import type { Metadata } from 'next'
import Link from 'next/link'
import { QaRowActions } from '@/components/console/qa-actions'
import { ConsoleSearchFilters } from '@/components/console/table-tools'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { CALL_OUTCOME_LABEL, duration, num, outcomeTone, relative } from '@/lib/format'
import { getQaQueue } from '@/server/data/console'

export const metadata: Metadata = { title: 'الجودة' }
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string; flag?: string }>
}

const QA_STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'open', label: 'بانتظار المراجعة' },
  { value: 'closed', label: 'مُغلقة' },
]

export default async function QaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status === 'open' || params.status === 'closed' ? params.status : undefined
  const search = params.q?.trim() || undefined
  const flag = params.flag?.trim() || undefined
  const { rows, totals, reasons } = await getQaQueue(60, {
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    ...(flag ? { flag } : {}),
  })

  return (
    <>
      <PageHead
        title="مركز الجودة"
        sub="المكالمات التي تحتاج قرارًا بشريًا — أغلقها بتصنيف واضح حتى يعرف الفريق ما يُصلح"
      />

      <ConsoleSearchFilters
        basePath="/console/qa"
        search={search ?? ''}
        status={status ?? 'all'}
        range="all"
        searchPlaceholder="ابحث بالعميل، النية، أو معرّف المكالمة…"
        statusOptions={QA_STATUS_OPTIONS}
        rangeOptions={[]}
      />

      <SummaryBar
        items={[
          {
            label: 'بانتظار المراجعة',
            value: num(totals.open),
            tone: totals.open > 0 ? 'warn' : 'good',
          },
          { label: 'مُغلقة', value: num(totals.closed) },
          { label: 'متوسط الدرجة', value: `${totals.avgScore}` },
          ...(reasons[0]
            ? [{ label: `الأكثر تكرارًا: ${reasons[0].flag}`, value: num(reasons[0].n) }]
            : []),
        ]}
      />

      <div className="split">
        <Section title="طابور المراجعة" meta={`${num(totals.open)} مفتوحة`} flush>
          {rows.length === 0 ? (
            <EmptyState
              title="لا شيء ينتظر المراجعة"
              body="عندما تُعلَّم مكالمة لسبب جودة ستظهر هنا مرتّبة من الأحدث."
            />
          ) : (
            <div className="table-scroll">
              <table className="table table--rows table--cards">
                <thead>
                  <tr>
                    <th>المتصل</th>
                    <th>العميل</th>
                    <th>النية</th>
                    <th>النتيجة</th>
                    <th>الدرجة</th>
                    <th>الأسباب</th>
                    <th>المدة</th>
                    <th>الحالة</th>
                    <th aria-label="إجراءات" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td data-label="المتصل">
                        <Link href={`/console/calls?call=${r.callId}`} className="mono">
                          {r.callerNumber ?? '—'}
                        </Link>
                      </td>
                      <td data-label="العميل" className="muted">
                        {r.workspaceName}
                      </td>
                      <td data-label="النية" className="muted">
                        {r.intent ?? '—'}
                      </td>
                      <td data-label="النتيجة">
                        <Pill tone={outcomeTone(r.outcome)}>
                          {r.outcome ? (CALL_OUTCOME_LABEL[r.outcome] ?? r.outcome) : '—'}
                        </Pill>
                      </td>
                      <td data-label="الدرجة" className="mono">
                        {r.score ?? '—'}
                      </td>
                      <td data-label="الأسباب">
                        <span className="queue__flags">
                          {(r.flags ?? []).slice(0, 2).map((f) => (
                            <Pill key={f} tone="warn">
                              {f}
                            </Pill>
                          ))}
                        </span>
                      </td>
                      <td data-label="المدة" className="mono">
                        {duration(r.durationSeconds)}
                      </td>
                      <td data-label="الحالة">
                        {r.reviewerId ? (
                          <Pill tone="good">رُوجعت · {relative(r.createdAt)}</Pill>
                        ) : (
                          <Pill tone="warn">مفتوحة</Pill>
                        )}
                      </td>
                      <td>
                        <QaRowActions
                          qaId={r.id}
                          callId={r.callId}
                          closed={Boolean(r.reviewerId)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="أسباب الدخول للطابور" meta="المفتوحة فقط" flush>
          <div className="queue">
            {reasons.length === 0 ? (
              <EmptyState
                title="لا أسباب مفتوحة حاليًا"
                body="ستظهر هنا أكثر أسباب المراجعة تكرارًا."
              />
            ) : (
              reasons.map((r) => (
                <div key={r.flag} className="queue__row">
                  <div className="queue__title">{r.flag}</div>
                  <span className="mono muted">{num(r.n)}</span>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </>
  )
}
