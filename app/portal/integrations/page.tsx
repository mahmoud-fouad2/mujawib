import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { HEALTH_LABEL, healthTone, relative } from '@/lib/format'
import { getPortalIntegrations, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'الربط' }
export const dynamic = 'force-dynamic'

/** Bible §5: the client sees connection state — never credentials or schemas. */
export default async function PortalIntegrationsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const integrations = await getPortalIntegrations(workspace.id)
  const needsAction = integrations.filter((i) => i.health !== 'connected')

  return (
    <>
      <PageHead title="الربط" sub="حالة اتصال الأنظمة التي يعمل مُجاوِب داخلها" />

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

      <Section title="الاتصالات" flush>
        {integrations.length === 0 ? (
          <EmptyState
            title="لا اتصالات بعد"
            body="سيظهر هنا كل نظام يُربط بمُجاوِب — التقويم، واتساب، وأنظمتك الداخلية."
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
