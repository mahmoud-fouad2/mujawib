import { CircleAlert, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { PlatformContactSettings } from '@/components/console/platform-contact-form'
import { MetricStrip, PageHead, Section } from '@/components/console/ui'
import { EmptyState } from '@/components/ui/primitives'
import { clock, fullDate, num, relative } from '@/lib/format'
import { requireOperatorPage } from '@/server/auth/access'
import { getSystemOverview } from '@/server/data/console'
import { getPlatformContactDraft } from '@/server/data/platform'

export const metadata: Metadata = { title: 'النظام' }
export const dynamic = 'force-dynamic'

const ACTION_LABEL: Record<string, string> = {
  'agent.publish': 'نشر نسخة',
  'integration.connect': 'ربط تكامل',
  'phone.route_change': 'تغيير مسار رقم',
  'qa.review': 'مراجعة جودة',
  'system.secret_baseline': 'تسجيل مرجعي لمفتاح تشفير',
  'system.secret_drift': 'تغيّر مفتاح تشفير',
  'system.contact_update': 'تحديث قنوات التواصل',
}

export default async function SystemPage() {
  const [{ counts, latency, audit, analytics, secretHealth }, contact, access] = await Promise.all([
    getSystemOverview(),
    getPlatformContactDraft(),
    requireOperatorPage('/console/system'),
  ])
  const recentChange = secretHealth.some((s) => s.status === 'recent-change')

  return (
    <>
      <PageHead
        title="حالة المنصة"
        sub="حجم البيانات، زمن استجابة الصوت، وسجل التدقيق لكل تغيير على الإنتاج"
      />

      {/*
        Written by server/security/secret-drift.ts at every boot. A change
        here means a signing or encryption key no longer matches what it was
        when data under it was created — every two-factor enrolment made
        under the old key stops verifying, and every value protected under
        the old encryption key reads back empty rather than erroring. The
        loud version of this lives in the boot log; this is the version that
        survives past whatever log retention Render applies.
      */}
      <Section
        title="صحة مفاتيح التشفير"
        meta={recentChange ? 'تغيّر حديثًا — راجع أدناه' : undefined}
      >
        <div className="secret-health">
          {secretHealth.map((s) => (
            <div key={s.key} className="secret-health__row" data-status={s.status}>
              {s.status === 'recent-change' ? (
                <CircleAlert size={16} aria-hidden="true" />
              ) : (
                <ShieldCheck size={16} aria-hidden="true" />
              )}
              <div>
                <strong>{s.label}</strong>
                <span>
                  {s.status === 'unknown'
                    ? 'لم يُرصد بعد — يُسجَّل عند أول إقلاع للخادم.'
                    : s.status === 'recent-change'
                      ? `تغيّرت القيمة الفعلية منذ ${s.since ? relative(s.since) : '—'}. الحسابات المسجَّلة بخطوتين قبل هذا التاريخ تحتاج إعادة تعيين: pnpm 2fa:status <email>`
                      : `مستقرة منذ ${s.since ? fullDate(s.since) : '—'}.`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="قنوات التواصل العامة" meta="ما يظهره الموقع وبيانات محركات البحث للزوار">
        <PlatformContactSettings canEdit={access.role === 'owner'} initial={contact} />
      </Section>

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

      <Section title="أداء الموقع" meta="آخر 30 يومًا، دون ملفات تعريف ارتباط أو بيانات زائر شخصية">
        <MetricStrip
          metrics={[
            { label: 'مشاهدات الصفحات', value: num(analytics.pageViews) },
            { label: 'نقرات الدعوة للإجراء', value: num(analytics.ctaClicks) },
            {
              label: 'معدل النقر',
              value: `${analytics.clickRate.toLocaleString('ar-SA', { maximumFractionDigits: 1 })}%`,
            },
          ]}
        />
        <div className="split">
          <div>
            <h3>الصفحات الأكثر مشاهدة</h3>
            <div className="queue">
              {analytics.topPages.map((item) => (
                <div key={item.path} className="queue__row">
                  <span className="mono">{item.path}</span>
                  <span className="mono muted">{num(item.count)}</span>
                </div>
              ))}
              {analytics.topPages.length === 0 ? (
                <span className="muted">لا بيانات بعد.</span>
              ) : null}
            </div>
          </div>
          <div>
            <h3>الدعوات الأكثر نقرًا</h3>
            <div className="queue">
              {analytics.topCtas.map((item) => (
                <div key={item.ctaId} className="queue__row">
                  <span className="mono">{item.ctaId}</span>
                  <span className="mono muted">{num(item.count)}</span>
                </div>
              ))}
              {analytics.topCtas.length === 0 ? (
                <span className="muted">لا بيانات بعد.</span>
              ) : null}
            </div>
          </div>
        </div>
      </Section>

      <div className="split">
        <Section title="سجل التدقيق" meta="كل تغيير على الإنتاج" flush>
          {audit.length === 0 ? (
            <EmptyState
              title="لا تغييرات مسجّلة بعد"
              body="سيظهر هنا كل تغيير مؤثر على الإنتاج — نشر نسخة، ربط تكامل، تغيير مسار رقم."
            />
          ) : (
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
                      <td
                        className="muted"
                        title={`${fullDate(a.createdAt)} ${clock(a.createdAt)}`}
                      >
                        {relative(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
