import type { Metadata } from 'next'
import { MetricStrip, PageHead, Section } from '@/components/console/ui'
import { clock, fullDate, num, relative } from '@/lib/format'
import { getSystemOverview } from '@/server/data/console'

export const metadata: Metadata = { title: 'النظام' }
export const dynamic = 'force-dynamic'

const ACTION_LABEL: Record<string, string> = {
  'agent.publish': 'نشر نسخة',
  'integration.connect': 'ربط تكامل',
  'phone.route_change': 'تغيير مسار رقم',
  'qa.review': 'مراجعة جودة',
}

export default async function SystemPage() {
  const { counts, latency, audit } = await getSystemOverview()

  return (
    <>
      <PageHead
        title="حالة المنصة"
        sub="حجم البيانات، زمن استجابة الصوت، وسجل التدقيق لكل تغيير على الإنتاج"
      />

      <MetricStrip
        metrics={[
          {
            label: 'زمن رد الصوت p50',
            value: `${num(latency.p50)}ms`,
            hint: `p95 ${num(latency.p95)}ms`,
          },
          { label: 'مكالمات مسجّلة', value: num(counts?.calls ?? 0) },
          { label: 'أحداث مكالمات', value: num(counts?.events ?? 0) },
          { label: 'تنفيذات أدوات', value: num(counts?.tools ?? 0) },
        ]}
      />

      <div className="split">
        <Section title="سجل التدقيق" meta="كل تغيير على الإنتاج" flush>
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الإجراء</th>
                  <th>التفصيل</th>
                  <th>العميل</th>
                  <th>المنفّذ</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{ACTION_LABEL[a.action] ?? a.action}</td>
                    <td className="muted">{(a.metadata as { note?: string })?.note ?? '—'}</td>
                    <td className="muted">{a.workspaceName ?? 'المنصة'}</td>
                    <td className="mono muted">{a.actorId ?? '—'}</td>
                    <td className="muted" title={`${fullDate(a.createdAt)} ${clock(a.createdAt)}`}>
                      {relative(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="حجم البيانات" flush>
          <div className="queue">
            {[
              { label: 'مساحات عمل العملاء', value: counts?.workspaces ?? 0 },
              { label: 'مدخلات المعرفة', value: counts?.knowledge ?? 0 },
              { label: 'المتصلون المعروفون', value: counts?.customers ?? 0 },
              { label: 'أحداث المكالمات', value: counts?.events ?? 0 },
            ].map((r) => (
              <div key={r.label} className="queue__row">
                <div className="queue__title">{r.label}</div>
                <span className="mono muted">{num(r.value)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
