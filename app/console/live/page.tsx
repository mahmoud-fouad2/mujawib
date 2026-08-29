import type { Metadata } from 'next'
import { LiveRefreshIndicator } from '@/components/console/live-refresh'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  CALL_STATUS_LABEL,
  clock,
  duration,
  EVENT_LABEL,
  maskPhone,
  num,
  statusTone,
} from '@/lib/format'
import { getLiveCalls, getOperationsSummary } from '@/server/data/console'

export const metadata: Metadata = { title: 'المباشر' }
export const dynamic = 'force-dynamic'

export default async function LivePage() {
  const [live, summary] = await Promise.all([getLiveCalls(), getOperationsSummary()])
  const now = Date.now()

  return (
    <>
      <PageHead
        title="المراقبة اللحظية"
        sub="المكالمات الجارية الآن وحالة كل واحدة منها"
        actions={<LiveRefreshIndicator />}
      />

      <SummaryBar
        items={[
          { label: 'مباشر الآن', value: num(live.length), tone: live.length ? 'good' : undefined },
          ...(live.filter((c) => c.status === 'waiting_tool').length
            ? [
                {
                  label: 'بانتظار أداة — قد يشير إلى بطء ربط',
                  value: num(live.filter((c) => c.status === 'waiting_tool').length),
                  tone: 'warn' as const,
                },
              ]
            : []),
          { label: 'مكالمة اليوم', value: num(summary.callsToday) },
          { label: 'خارج ساعات العمل اليوم', value: num(summary.afterHours) },
        ]}
      />

      <Section title="المكالمات الجارية" flush>
        {live.length === 0 ? (
          <EmptyState
            title="لا مكالمات جارية"
            body="عندما يرد مُجاوِب على مكالمة ستظهر هنا مع حالتها اللحظية وآخر حدث فيها."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>المتصل</th>
                  <th>العميل</th>
                  <th>الموظف</th>
                  <th>الحالة</th>
                  <th>النية</th>
                  <th>آخر حدث</th>
                  <th>بدأت</th>
                  <th>المدة</th>
                </tr>
              </thead>
              <tbody>
                {live.map((c) => {
                  const secs = Math.max(
                    0,
                    Math.round((now - new Date(c.startedAt).getTime()) / 1000),
                  )
                  return (
                    <tr key={c.id}>
                      <td className="mono">{maskPhone(c.callerNumber)}</td>
                      <td>{c.workspaceName}</td>
                      <td>{c.agentName ?? '—'}</td>
                      <td>
                        <Pill tone={statusTone(c.status)} live={c.status === 'live'}>
                          {CALL_STATUS_LABEL[c.status] ?? c.status}
                        </Pill>
                      </td>
                      <td className="muted">{c.intent ?? '—'}</td>
                      <td className="muted">
                        {c.lastEvent ? (EVENT_LABEL[c.lastEvent] ?? c.lastEvent) : '—'}
                      </td>
                      <td className="mono">{clock(c.startedAt)}</td>
                      <td className="mono">{duration(secs)}</td>
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
