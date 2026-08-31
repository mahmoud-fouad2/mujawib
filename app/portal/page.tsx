import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MetricStrip, PageHead, Section } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CHANGE_STATUS_LABEL,
  duration,
  num,
  outcomeTone,
  relative,
} from '@/lib/format'
import {
  getPortalCalls,
  getPortalInsights,
  getPortalRequests,
  getPortalSummary,
  getPortalWorkspace,
  getTopReasons,
} from '@/server/data/portal'

export const dynamic = 'force-dynamic'

function delta(current: number, prior: number) {
  if (prior === 0) return undefined
  return { value: Math.round(((current - prior) / prior) * 100) }
}

export default async function PortalOverviewPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const [summary, insights, reasons, calls, requests] = await Promise.all([
    getPortalSummary(workspace.id),
    getPortalInsights(workspace.id),
    getTopReasons(workspace.id),
    getPortalCalls(workspace.id, 8),
    getPortalRequests(workspace.id),
  ])

  const openRequests = requests.filter((r) => r.status !== 'live' && r.status !== 'rejected')

  return (
    <>
      <PageHead title="نظرة عامة" sub="آخر 30 يومًا — ماذا حدث في مكالماتك وماذا أنجزه الصوت" />

      {summary.answered === 0 ? (
        <div className="welcome-hero">
          <div className="welcome-hero__head">
            <h3>مرحبًا بك في مُجاوِب — مساحة عمل «{workspace.name}»</h3>
          </div>
          <p className="welcome-hero__body">
            يقوم فريق التشغيل لدينا حاليًا بتهيئة واختبار الموظف الصوتي لشركتكم وفق أعلى معايير
            الجودة العربية. ستظهر هنا كافة إحصائيات المكالمات والحجوزات ومؤشرات الأداء فور إطلاق
            الخدمة على رقمكم.
          </p>
          <div className="welcome-hero__pills">
            <Pill tone="good">✓ تم تجهيز مساحة العمل</Pill>
            <Pill tone="good">✓ تخصيص الهوية واللهجة</Pill>
            <Pill tone="signal">جاهزية استقبال المكالمات</Pill>
          </div>
          <div className="welcome-hero__actions">
            <Link href="/portal/business-info" className="btn btn--sm btn--primary">
              مراجعة وتحديث بيانات نشاطك
            </Link>
            <Link href="/portal/requests" className="btn btn--sm btn--quiet">
              طلب تعديل أو إضافة خدمة
            </Link>
          </div>
        </div>
      ) : null}

      <MetricStrip
        metrics={[
          {
            label: 'مكالمات مُجابة',
            value: num(summary.answered),
            delta: delta(summary.answered, summary.answeredPrior),
          },
          {
            label: 'حجوزات من الصوت',
            value: num(summary.bookings),
            delta: delta(summary.bookings, summary.bookingsPrior),
          },
          {
            label: 'أُغلقت بدون موظف',
            value: `${summary.resolvedRate}%`,
            hint: `${num(summary.transfers)} تحويل للفريق`,
          },
          {
            label: 'خارج ساعات العمل',
            value: num(summary.afterHours),
            hint: 'فرص لم تضِع',
          },
        ]}
      />

      <div className="split">
        <Section
          title="ما الذي تغيّر؟"
          meta="مستخلص من بيانات مكالماتك"
          action={
            <Link href="/portal/insights" className="btn btn--quiet btn--sm">
              كل الرؤى
              <ArrowLeft size={14} className="arrow" aria-hidden="true" />
            </Link>
          }
          flush
        >
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

        <Section title="أسباب الاتصال الأعلى" flush>
          {reasons.map((r) => (
            <div key={r.reason} className="share-row">
              <div>
                <div className="share-row__label">{r.reason}</div>
                <div className="share-row__track">
                  <span className="share-row__fill" style={{ width: `${r.share}%` }} />
                </div>
              </div>
              <span className="share-row__value">{r.share}%</span>
            </div>
          ))}
        </Section>
      </div>

      <div className="split">
        <Section
          title="آخر المكالمات"
          action={
            <Link href="/portal/calls" className="btn btn--quiet btn--sm">
              الكل
            </Link>
          }
          flush
        >
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>المتصل</th>
                  <th>السبب</th>
                  <th>النتيجة</th>
                  <th>المدة</th>
                  <th>منذ</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.callerNumber ?? '—'}</td>
                    <td className="muted">{c.intent ?? '—'}</td>
                    <td>
                      <Pill tone={outcomeTone(c.outcome)}>
                        {c.outcome ? (CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome) : '—'}
                      </Pill>
                    </td>
                    <td className="mono">{duration(c.durationSeconds)}</td>
                    <td className="muted">{relative(c.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="طلبات التعديل"
          meta={`${num(openRequests.length)} قيد التنفيذ`}
          action={
            <Link href="/portal/requests" className="btn btn--quiet btn--sm">
              الكل
            </Link>
          }
          flush
        >
          {openRequests.length === 0 ? (
            <div className="empty">
              <p>لا طلبات مفتوحة حاليًا.</p>
            </div>
          ) : (
            <div className="queue">
              {openRequests.slice(0, 5).map((r) => (
                <div key={r.id} className="queue__row">
                  <div>
                    <div className="queue__title">{r.title}</div>
                    <div className="queue__meta">{relative(r.createdAt)}</div>
                  </div>
                  <Pill tone={r.status === 'scheduled' ? 'signal' : 'warn'}>
                    {CHANGE_STATUS_LABEL[r.status] ?? r.status}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  )
}
