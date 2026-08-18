import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { MetricStrip, PageHead, Section, StatusStrip, VolumeBars } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CALL_STATUS_LABEL,
  dayMonth,
  duration,
  fullDate,
  maskPhone,
  num,
  outcomeTone,
  relative,
  statusTone,
} from '@/lib/format'
import {
  getCallTrend,
  getClientsAtRisk,
  getLiveCalls,
  getNeedsAttention,
  getOperationsSummary,
  getPlatformStatus,
  getRecentActivity,
} from '@/server/data/console'

export const dynamic = 'force-dynamic'

function delta(current: number, prior: number) {
  if (prior === 0) return undefined
  return { value: Math.round(((current - prior) / prior) * 100) }
}

export default async function ConsoleHomePage() {
  const [summary, signals, attention, live, risk, trend, activity] = await Promise.all([
    getOperationsSummary(),
    getPlatformStatus(),
    getNeedsAttention(7),
    getLiveCalls(),
    getClientsAtRisk(),
    getCallTrend(14),
    getRecentActivity(6),
  ])

  return (
    <>
      <PageHead title="مركز التشغيل" sub={`${fullDate(new Date())} · تُحدَّث الأرقام مع كل تحميل`} />

      <StatusStrip signals={signals} />

      <MetricStrip
        metrics={[
          {
            label: 'مباشر الآن',
            value: num(summary.liveNow),
            hint: summary.liveNow > 0 ? 'مكالمات جارية' : 'لا مكالمات جارية',
          },
          {
            label: 'مكالمات اليوم',
            value: num(summary.callsToday),
            delta: delta(summary.callsToday, summary.callsPriorDay),
          },
          {
            label: 'حجوزات اليوم',
            value: num(summary.bookingsToday),
            delta: delta(summary.bookingsToday, summary.bookingsPriorDay),
          },
          {
            label: 'أُغلقت بدون تدخل',
            value: `${summary.resolvedRate}%`,
            hint: `${num(summary.needsReview)} بانتظار المراجعة`,
          },
        ]}
      />

      <div className="split">
        {/* The queue is the page's centre of gravity, not a chart. */}
        <Section
          title="يحتاج انتباهك"
          meta={`${num(summary.needsReview)} مكالمة في طابور المراجعة`}
          action={
            <Link href="/console/qa" className="btn btn--quiet btn--sm">
              فتح الطابور
              <ArrowLeft size={14} className="arrow" aria-hidden="true" />
            </Link>
          }
          flush
        >
          {attention.length === 0 ? (
            <div className="empty">
              <h3>لا شيء ينتظر المراجعة</h3>
              <p>كل المكالمات المُعلَّمة تمت مراجعتها.</p>
            </div>
          ) : (
            <div className="queue">
              {attention.map((a) => (
                <Link
                  key={a.callId}
                  href={`/console/calls?call=${a.callId}`}
                  className="queue__row"
                >
                  <div>
                    <div className="queue__title">
                      {a.intent ?? 'مكالمة'} — {a.workspaceName}
                    </div>
                    <div className="queue__meta">
                      <span className="mono">{maskPhone(a.callerNumber)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{relative(a.createdAt)}</span>
                      <span className="queue__flags">
                        {(a.flags ?? []).slice(0, 2).map((f) => (
                          <Pill key={f} tone="warn">
                            {f}
                          </Pill>
                        ))}
                      </span>
                    </div>
                  </div>
                  <Pill tone={outcomeTone(a.outcome)}>
                    {a.outcome ? (CALL_OUTCOME_LABEL[a.outcome] ?? a.outcome) : '—'}
                  </Pill>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <div className="stack">
          <Section title="حجم المكالمات" meta="آخر 14 يومًا · الملوّن أُغلق بدون تدخل" flush>
            <VolumeBars
              data={trend}
              fromLabel={dayMonth(trend[0]?.day ?? new Date())}
              toLabel={dayMonth(trend.at(-1)?.day ?? new Date())}
            />
          </Section>

          <Section title="عملاء يحتاجون متابعة" flush>
            {risk.length === 0 ? (
              <div className="empty">
                <p>لا مؤشرات خطر هذا الأسبوع.</p>
              </div>
            ) : (
              <div className="queue">
                {risk.map((r) => (
                  <div key={r.workspaceId} className="queue__row">
                    <div>
                      <div className="queue__title">{r.name}</div>
                      <div className="queue__meta">
                        <span>تحويل {r.transferRate}%</span>
                        <span aria-hidden="true">·</span>
                        <span>غير محلولة {r.unresolvedRate}%</span>
                        <span aria-hidden="true">·</span>
                        <span className="mono">{num(r.calls7d)} مكالمة</span>
                      </div>
                    </div>
                    {r.degradedIntegrations > 0 ? (
                      <Pill tone="bad">{num(r.degradedIntegrations)} ربط متعثر</Pill>
                    ) : (
                      <Pill tone="warn">متابعة</Pill>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <div className="split">
        <Section
          title="مكالمات مباشرة"
          meta={live.length > 0 ? `${num(live.length)} جارية الآن` : undefined}
          action={
            <Link href="/console/live" className="btn btn--quiet btn--sm">
              الكل
            </Link>
          }
          flush
        >
          {live.length === 0 ? (
            <div className="empty">
              <p>لا مكالمات جارية في هذه اللحظة.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table table--rows">
                <thead>
                  <tr>
                    <th>المتصل</th>
                    <th>العميل</th>
                    <th>الحالة</th>
                    <th>النية</th>
                    <th>المدة</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((c) => {
                    const secs = Math.max(
                      0,
                      Math.round((Date.now() - new Date(c.startedAt).getTime()) / 1000),
                    )
                    return (
                      <tr key={c.id}>
                        <td className="mono">{maskPhone(c.callerNumber)}</td>
                        <td>{c.workspaceName}</td>
                        <td>
                          <Pill tone={statusTone(c.status)} live={c.status === 'live'}>
                            {CALL_STATUS_LABEL[c.status] ?? c.status}
                          </Pill>
                        </td>
                        <td className="muted">{c.intent ?? '—'}</td>
                        <td className="mono">{duration(secs)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="آخر ما جرى" flush>
          <div className="queue">
            {activity.map((a) => (
              <div key={a.id} className="queue__row">
                <div>
                  <div className="queue__title">
                    {(a.metadata as { note?: string })?.note ?? a.action}
                  </div>
                  <div className="queue__meta">
                    <span className="mono">{a.action}</span>
                    <span aria-hidden="true">·</span>
                    <span>{a.workspaceName ?? 'المنصة'}</span>
                  </div>
                </div>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  {relative(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
