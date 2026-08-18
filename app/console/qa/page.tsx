import type { Metadata } from 'next'
import Link from 'next/link'
import { QaRowActions } from '@/components/console/qa-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { CALL_OUTCOME_LABEL, duration, maskPhone, num, outcomeTone, relative } from '@/lib/format'
import { getQaQueue } from '@/server/data/console'

export const metadata: Metadata = { title: 'الجودة' }
export const dynamic = 'force-dynamic'

export default async function QaPage() {
  const { rows, totals, reasons } = await getQaQueue(60)
  const open = rows.filter((r) => !r.reviewerId)

  return (
    <>
      <PageHead
        title="مركز الجودة"
        sub="المكالمات التي تحتاج قرارًا بشريًا — أغلقها بتصنيف واضح حتى يعرف الفريق ما يُصلح"
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
        <Section title="طابور المراجعة" meta={`${num(open.length)} مفتوحة`} flush>
          {rows.length === 0 ? (
            <EmptyState
              title="لا شيء ينتظر المراجعة"
              body="عندما تُعلَّم مكالمة لسبب جودة ستظهر هنا مرتّبة من الأحدث."
            />
          ) : (
            <div className="table-scroll">
              <table className="table table--rows">
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
                      <td>
                        <Link href={`/console/calls?call=${r.callId}`} className="mono">
                          {maskPhone(r.callerNumber)}
                        </Link>
                      </td>
                      <td className="muted">{r.workspaceName}</td>
                      <td className="muted">{r.intent ?? '—'}</td>
                      <td>
                        <Pill tone={outcomeTone(r.outcome)}>
                          {r.outcome ? (CALL_OUTCOME_LABEL[r.outcome] ?? r.outcome) : '—'}
                        </Pill>
                      </td>
                      <td className="mono">{r.score ?? '—'}</td>
                      <td>
                        <span className="queue__flags">
                          {(r.flags ?? []).slice(0, 2).map((f) => (
                            <Pill key={f} tone="warn">
                              {f}
                            </Pill>
                          ))}
                        </span>
                      </td>
                      <td className="mono">{duration(r.durationSeconds)}</td>
                      <td>
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
              <div className="empty">
                <p>لا أسباب مفتوحة حاليًا.</p>
              </div>
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
