import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DailyBars, Ratio, ShareBars, Sparkline } from '@/components/console/charts'
import { PageHead, Section, StatusStrip } from '@/components/console/ui'
import { Equaliser } from '@/components/ui/motion'
import { EmptyState, Pill } from '@/components/ui/primitives'
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
  getMetricTrends,
  getNeedsAttention,
  getOperationsSummary,
  getPlatformStatus,
  getRecentActivity,
} from '@/server/data/console'

export const dynamic = 'force-dynamic'

function delta(current: number, prior: number) {
  if (prior === 0) return null
  return Math.round(((current - prior) / prior) * 100)
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return (
    <span className="metric__delta" data-dir={dir}>
      {value > 0 ? '+' : ''}
      {num(value)}% عن أمس
    </span>
  )
}

export default async function ConsoleHomePage() {
  const [summary, signals, attention, live, risk, trend, activity, trends] = await Promise.all([
    getOperationsSummary(),
    getPlatformStatus(),
    getNeedsAttention(6),
    getLiveCalls(),
    getClientsAtRisk(),
    getCallTrend(14),
    getRecentActivity(6),
    getMetricTrends(),
  ])

  const now = Date.now()

  return (
    <>
      <PageHead title="مركز التشغيل" sub={fullDate(new Date())} />

      <StatusStrip signals={signals} />

      {/* Every figure carries its own seven-day line: a number without a
          direction does not tell an operator anything. */}
      <div className="metrics">
        <div className="metric">
          <span className="metric__label">مباشر الآن</span>
          <span className="metric__value">
            {summary.liveNow > 0 ? (
              <span className="live-row">
                {num(summary.liveNow)}
                <Equaliser bars={4} className="live-row__eq" />
              </span>
            ) : (
              num(0)
            )}
          </span>
          <span className="metric__delta" data-dir="flat">
            {summary.liveNow > 0 ? 'مكالمات على الخط' : 'لا مكالمات جارية'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">مكالمات اليوم</span>
          <span className="metric__value">{num(summary.callsToday)}</span>
          <Delta value={delta(summary.callsToday, summary.callsPriorDay)} />
          <span className="metric__spark">
            <Sparkline points={trends.calls} tone="signal" />
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">حجوزات اليوم</span>
          <span className="metric__value">{num(summary.bookingsToday)}</span>
          <Delta value={delta(summary.bookingsToday, summary.bookingsPriorDay)} />
          <span className="metric__spark">
            <Sparkline points={trends.bookings} tone="good" />
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">تحتاج مراجعة</span>
          <span className="metric__value">{num(summary.needsReview)}</span>
          <span className="metric__delta" data-dir={summary.needsReview > 0 ? 'down' : 'flat'}>
            في طابور الجودة
          </span>
          <span className="metric__spark">
            <Sparkline points={trends.reviews} tone="warn" />
          </span>
        </div>
      </div>

      <div className="split">
        {/* The queue is the centre of gravity, not a chart. */}
        <Section
          title="يحتاج انتباهك"
          meta={`${num(summary.needsReview)} في الطابور`}
          action={
            <Link href="/console/qa" className="btn btn--quiet btn--sm">
              افتح الطابور
              <ArrowLeft size={14} className="arrow" aria-hidden="true" />
            </Link>
          }
          flush
        >
          {attention.length === 0 ? (
            <EmptyState title="لا شيء ينتظر المراجعة" body="كل المكالمات المُعلَّمة تمت مراجعتها." />
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
          <Section
            title="أُغلقت بدون تدخل"
            meta="اليوم"
            action={
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                {num(summary.afterHours)} خارج الدوام
              </span>
            }
          >
            <div className="ratio-row">
              <Ratio
                value={summary.resolvedRate}
                label="نسبة الإغلاق بدون تدخل"
                tone={summary.resolvedRate >= 75 ? 'good' : 'warn'}
              />
              <div className="ratio-row__note">
                <p>
                  من المكالمات المنتهية اليوم أُغلقت دون أن يتدخل موظف. الباقي إمّا تحويل أو معاودة
                  اتصال.
                </p>
                <Sparkline points={trends.resolvedRate} tone="good" width={140} height={32} />
              </div>
            </div>
          </Section>

          <Section title="حجم المكالمات" meta="آخر 14 يومًا" flush>
            <DailyBars
              points={trend.map((t) => ({
                label: dayMonth(t.day),
                value: t.total,
                secondary: t.resolved,
              }))}
              fromLabel={dayMonth(trend[0]?.day ?? new Date())}
              toLabel={dayMonth(trend.at(-1)?.day ?? new Date())}
              legend={{ total: 'إجمالي المكالمات', filled: 'أُغلقت بدون تدخل' }}
            />
          </Section>
        </div>
      </div>

      <div className="split">
        <Section
          title="مكالمات مباشرة"
          meta={live.length > 0 ? `${num(live.length)} على الخط` : undefined}
          action={
            <Link href="/console/live" className="btn btn--quiet btn--sm">
              الكل
            </Link>
          }
          flush
        >
          {live.length === 0 ? (
            <EmptyState
              title="لا مكالمات جارية"
              body="ستظهر هنا كل مكالمة يستقبلها المُجاوِب في هذه اللحظة."
            />
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
                      Math.round((now - new Date(c.startedAt).getTime()) / 1000),
                    )
                    return (
                      <tr key={c.id}>
                        <td className="mono">{maskPhone(c.callerNumber)}</td>
                        <td>{c.workspaceName}</td>
                        <td>
                          <span className="live-row">
                            {c.status === 'live' ? (
                              <Equaliser bars={3} className="live-row__eq" />
                            ) : null}
                            <Pill tone={statusTone(c.status)}>
                              {CALL_STATUS_LABEL[c.status] ?? c.status}
                            </Pill>
                          </span>
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

        <Section title="عملاء يحتاجون متابعة" meta="آخر 7 أيام" flush>
          {risk.length === 0 ? (
            <EmptyState
              title="لا مؤشرات خطر"
              body="لا عميل يظهر تحويلاً أو نتائج غير محلولة أعلى من المعتاد هذا الأسبوع."
            />
          ) : (
            <ShareBars
              tone="warn"
              rows={risk.map((r) => ({
                label: r.name,
                value: r.transferRate + r.unresolvedRate,
                note: `تحويل ${r.transferRate}% · غير محلولة ${r.unresolvedRate}%`,
              }))}
            />
          )}
        </Section>
      </div>

      <Section title="آخر ما جرى" meta="سجل التدقيق" flush>
        {activity.length === 0 ? (
          <EmptyState title="لا نشاط بعد" body="سيظهر هنا كل تغيير مؤثر على الإنتاج فور حدوثه." />
        ) : (
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
        )}
      </Section>
    </>
  )
}
