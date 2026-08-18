import type { Metadata } from 'next'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import { num } from '@/lib/format'
import { getTemplates } from '@/server/data/console'

export const metadata: Metadata = { title: 'القوالب' }
export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const templates = await getTemplates()
  const inUse = templates.filter((t) => t.clients > 0).length
  const flows = templates.reduce((s, t) => s + ((t.defaultFlows as unknown[]) ?? []).length, 0)

  return (
    <>
      <PageHead
        title="قوالب القطاعات"
        sub="أربع حزم مدعومة بالكامل — كل حزمة تحمل مخطط معرفتها ومساراتها وحزمة اختبارها"
      />

      <SummaryBar
        items={[
          { label: 'قالب', value: num(templates.length) },
          { label: 'قيد الاستخدام', value: num(inUse), tone: 'good' },
          { label: 'مسار جاهز', value: num(flows) },
          { label: 'شركة مشغَّلة', value: num(templates.reduce((s, t) => s + t.clients, 0)) },
        ]}
      />

      <Section title="الحزم" flush>
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>القالب</th>
                <th>النسخة</th>
                <th>شركات تستخدمه</th>
                <th>المسارات</th>
                <th>التكاملات الافتراضية</th>
                <th>حزمة الاختبار</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const tFlows = ((t.defaultFlows as string[]) ?? []).filter(Boolean)
                const tInts = ((t.defaultIntegrations as string[]) ?? []).filter(Boolean)
                const tQa = ((t.qaSuite as string[]) ?? []).filter(Boolean)
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td className="mono">{t.version}</td>
                    <td>
                      {t.clients > 0 ? (
                        <Pill tone="good">{num(t.clients)}</Pill>
                      ) : (
                        <Pill>غير مستخدم</Pill>
                      )}
                    </td>
                    <td>
                      <span className="queue__flags">
                        {tFlows.map((f) => (
                          <Pill key={f}>{f}</Pill>
                        ))}
                      </span>
                    </td>
                    <td>
                      <span className="queue__flags">
                        {tInts.map((i) => (
                          <code key={i} className="mono" style={{ fontSize: '0.6875rem' }}>
                            {i}
                          </code>
                        ))}
                      </span>
                    </td>
                    <td className="mono">{num(tQa.length)} سيناريو</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
