import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar, VolumeBars } from '@/components/console/ui'
import { dayMonth, num } from '@/lib/format'
import {
  getPortalHourly,
  getPortalInsights,
  getPortalSummary,
  getPortalTrend,
  getPortalWorkspace,
  getTopReasons,
} from '@/server/data/portal'

export const metadata: Metadata = { title: 'الرؤى' }
export const dynamic = 'force-dynamic'

const DEFAULT_WORK_START = 9
const DEFAULT_WORK_END = 21

/**
 * Opening hours are free text (Bible §21 — clients can publish anything up
 * to 40 chars, so most don't match this shape). Only the common
 * "09:00–21:00" form is read; anything else keeps the default rather than
 * risk shading the chart by a wrong, silently-misparsed guess.
 */
function parseWorkHours(raw: string | undefined): { start: number; end: number } {
  const match = raw?.match(/(\d{1,2}):\d{2}\s*[-–]\s*(\d{1,2}):\d{2}/)
  if (!match) return { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }
  const start = Number(match[1])
  const end = Number(match[2])
  const valid =
    Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= 24
  return valid ? { start, end } : { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }
}

export default async function PortalInsightsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const businessInfo = (workspace.businessInfo ?? {}) as { hours?: Record<string, string> }
  const { start: WORK_START, end: WORK_END } = parseWorkHours(businessInfo.hours?.sun_thu)

  const [summary, insights, reasons, trend, hourly] = await Promise.all([
    getPortalSummary(workspace.id),
    getPortalInsights(workspace.id),
    getTopReasons(workspace.id),
    getPortalTrend(workspace.id, 30),
    getPortalHourly(workspace.id),
  ])

  const maxHour = Math.max(1, ...hourly.map((h) => h.n))
  const conversion = summary.answered ? Math.round((summary.bookings / summary.answered) * 100) : 0

  return (
    <>
      <PageHead title="الرؤى" sub="اتجاهات آخر 30 يومًا، وأين توجد الفرص" />

      <SummaryBar
        items={[
          { label: 'من المكالمات انتهت بحجز', value: `${conversion}%`, tone: 'good' },
          { label: 'عميل محتمل', value: num(summary.leads) },
          { label: 'تحويل للفريق', value: num(summary.transfers) },
          { label: 'مكالمة خارج الدوام', value: num(summary.afterHours) },
        ]}
      />

      <div className="split">
        <Section title="حجم المكالمات" meta="آخر 30 يومًا · الملوّن انتهى بحجز" flush>
          <VolumeBars
            data={trend.map((t) => ({ day: t.day, total: t.total, resolved: t.bookings }))}
            fromLabel={dayMonth(trend[0]?.day ?? new Date())}
            toLabel={dayMonth(trend.at(-1)?.day ?? new Date())}
          />
        </Section>

        <Section title="ما الذي تغيّر؟" flush>
          {insights.length === 0 ? (
            <div className="empty">
              <p>لا تغيّرات جوهرية هذا الشهر.</p>
            </div>
          ) : (
            <ul className="insight-list">
              {insights.map((i) => (
                <li key={i.text} data-tone={i.tone}>
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="split">
        <Section title="توزيع المكالمات على ساعات اليوم" meta="الرمادي خارج ساعات العمل" flush>
          <div className="bars" role="img" aria-label="توزيع المكالمات حسب الساعة">
            {hourly.map((h) => {
              const outside = h.hour < WORK_START || h.hour >= WORK_END
              return (
                <div
                  key={h.hour}
                  className="bars__col"
                  style={{ height: `${(h.n / maxHour) * 100}%` }}
                  title={`${h.hour}:00 — ${h.n}`}
                >
                  <i
                    style={{
                      height: '100%',
                      background: outside ? 'var(--text-faint)' : 'var(--signal)',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="bars__axis">
            <span>{hourly[0]?.hour ?? 0}:00</span>
            <span>{hourly.at(-1)?.hour ?? 23}:00</span>
          </div>
        </Section>

        <Section title="أسباب الاتصال" flush>
          {reasons.map((r) => (
            <div key={r.reason} className="share-row">
              <div>
                <div className="share-row__label">{r.reason}</div>
                <div className="share-row__track">
                  <span className="share-row__fill" style={{ width: `${r.share}%` }} />
                </div>
              </div>
              <span className="share-row__value">{num(r.n)}</span>
            </div>
          ))}
        </Section>
      </div>
    </>
  )
}
