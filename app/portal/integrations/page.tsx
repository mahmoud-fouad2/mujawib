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
          <div className="integration-card">
            <div className="integration-card__head">
              <div className="integration-card__icon">
                <Calendar size={18} />
              </div>
              <strong className="integration-card__title">Google Calendar & Cal.com</strong>
            </div>
            <p className="integration-card__desc">
              قراءة الخانات المتاحة فورياً وتثبيت المواعيد مباشرة في تقويم الفريق أو الموارد دون أي
              تعارض.
            </p>
            <div className="integration-card__footer">
              <Pill tone="good">مدعوم وجاهز</Pill>
            </div>
          </div>

          <div className="integration-card">
            <div className="integration-card__head">
              <div className="integration-card__icon">
                <MessageSquare size={18} />
              </div>
              <strong className="integration-card__title">WhatsApp Cloud & Twilio</strong>
            </div>
            <p className="integration-card__desc">
              إرسال رسائل تأكيد الحجوزات والموقع وتعليمات الزيارة تلقائياً على جوال المتصل بمجرد
              إغلاق الخط.
            </p>
            <div className="integration-card__footer">
              <Pill tone="good">مدعوم وجاهز</Pill>
            </div>
          </div>

          <div className="integration-card">
            <div className="integration-card__head">
              <div className="integration-card__icon">
                <Network size={18} />
              </div>
              <strong className="integration-card__title">Webhooks & أنظمة الـ CRM</strong>
            </div>
            <p className="integration-card__desc">
              إرسال ملخص كل مكالمة وبيانات المتصلين تلقائياً إلى CRM أو نظام المنشأة الداخلي.
            </p>
            <div className="integration-card__footer">
              <Pill tone="good">مدعوم وجاهز</Pill>
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
