import { Calendar, MessageSquare, Network } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { HEALTH_LABEL, healthTone, relative } from '@/lib/format'
import { getPortalIntegrations, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'الربط' }
export const dynamic = 'force-dynamic'

export default async function PortalIntegrationsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const integrations = await getPortalIntegrations(workspace.id)
  const needsAction = integrations.filter((i) => i.health !== 'connected')

  return (
    <>
      <PageHead title="الربط والتكاملات" sub="حالة اتصال الأنظمة والتقويم التي يعمل مُجاوِب داخلها" />

      {needsAction.length > 0 ? (
        <div className="status-strip">
          <div className="status-signal" data-tone="warn">
            <strong>يحتاج انتباهك</strong>
            <span>
              {needsAction.length} اتصال غير سليم — فريق مُجاوِب يتابع إعادة الربط، ولن يتم تأكيد أي
              حجز قبل نجاح الاتصال.
            </span>
          </div>
        </div>
      ) : null}

      {/* Available Ecosystem Integrations */}
      <Section title="الأنظمة وقنوات الربط المدعومة" meta="تكاملات مباشرة">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--s-4)',
          }}
        >
          <div
            className="card-sub"
            style={{
              padding: 'var(--s-4)',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div
              className="row"
              style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)', alignItems: 'center' }}
            >
              <Calendar size={18} style={{ color: 'var(--signal)' }} />
              <strong style={{ fontSize: 'var(--step-0)' }}>Google Calendar & Cal.com</strong>
            </div>
            <p
              style={{
                fontSize: 'var(--step--1)',
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginBlockEnd: 'var(--s-3)',
              }}
            >
              قراءة الخانات المتاحة فورياً وتثبيت المواعيد مباشرة في تقويم أطباء وفريق المنشأة دون أي
              تعارض.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
              <span className="pill pill--good">مدعوم وجاهز</span>
            </div>
          </div>

          <div
            className="card-sub"
            style={{
              padding: 'var(--s-4)',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div
              className="row"
              style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)', alignItems: 'center' }}
            >
              <MessageSquare size={18} style={{ color: 'var(--signal)' }} />
              <strong style={{ fontSize: 'var(--step-0)' }}>WhatsApp Cloud & Twilio</strong>
            </div>
            <p
              style={{
                fontSize: 'var(--step--1)',
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginBlockEnd: 'var(--s-3)',
              }}
            >
              إرسال رسائل تأكيد الحجوزات والموقع وتعليمات الزيارة تلقائياً على جوال المتصل بمجرد
              إغلاق الخط.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
              <span className="pill pill--good">مدعوم وجاهز</span>
            </div>
          </div>

          <div
            className="card-sub"
            style={{
              padding: 'var(--s-4)',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div
              className="row"
              style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)', alignItems: 'center' }}
            >
              <Network size={18} style={{ color: 'var(--signal)' }} />
              <strong style={{ fontSize: 'var(--step-0)' }}>Webhooks & أنظمة الـ CRM</strong>
            </div>
            <p
              style={{
                fontSize: 'var(--step--1)',
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginBlockEnd: 'var(--s-3)',
              }}
            >
              إرسال ملخص كل مكالمة وبيانات المتصلين تلقائياً إلى نظام إدارة العيادات أو نظام المنشأة
              الداخلي.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
              <span className="pill pill--good">مدعوم وجاهز</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="الاتصالات المربوطة حالياً" flush>
        {integrations.length === 0 ? (
          <EmptyState
            title="لا اتصالات نشطة بعد"
            body="سيظهر هنا كل نظام نشط يُربط بمُجاوِب — التقويم، واتساب، وأنظمتك الداخلية."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>النظام</th>
                  <th>الحالة</th>
                  <th>آخر عملية ناجحة</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 500 }}>{i.label}</td>
                    <td>
                      <Pill tone={healthTone(i.health)} dot>
                        {HEALTH_LABEL[i.health] ?? i.health}
                      </Pill>
                    </td>
                    <td className="muted">{i.lastSuccessAt ? relative(i.lastSuccessAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
