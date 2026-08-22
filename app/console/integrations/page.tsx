import type { Metadata } from 'next'
import { IntegrationRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { HEALTH_LABEL, healthTone, num, relative, TOOL_LABEL } from '@/lib/format'
import { INTEGRATION_ACTION_LABEL } from '@/lib/integrations'
import { getIntegrations } from '@/server/data/console'

export const metadata: Metadata = { title: 'الربط' }
export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const { rows, executions } = await getIntegrations()

  const connected = rows.filter((r) => r.health === 'connected').length
  const ready = rows.filter((r) => r.setup.ready).length
  const degraded = rows.filter((r) => r.health === 'degraded').length
  const failed = rows.filter((r) => r.health === 'failed').length
  const totalRuns = executions.reduce((s, e) => s + e.total, 0)
  const totalFailed = executions.reduce((s, e) => s + e.failed, 0)

  return (
    <>
      <PageHead
        title="الربط والأدوات"
        sub="حالة كل اتصال، والأثر الفعلي لتنفيذ الأدوات خلال آخر سبعة أيام"
      />

      <SummaryBar
        items={[
          { label: `جاهز للتشغيل من ${num(rows.length)}`, value: num(ready), tone: 'good' },
          { label: 'تم التحقق من الاتصال', value: num(connected) },
          ...(degraded ? [{ label: 'متذبذب', value: num(degraded), tone: 'warn' as const }] : []),
          ...(failed ? [{ label: 'متوقف', value: num(failed), tone: 'bad' as const }] : []),
          {
            label: `نجاح التنفيذ من ${num(totalRuns)}`,
            value: totalRuns
              ? `${Math.round(((totalRuns - totalFailed) / totalRuns) * 100)}%`
              : '—',
          },
        ]}
      />

      <Section title="الاتصالات" flush>
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>المزوّد</th>
                <th>العميل</th>
                <th>الحالة</th>
                <th>جاهزية التشغيل</th>
                <th>آخر تحقق ناجح</th>
                <th>آخر تعثر</th>
                <th aria-label="إجراءات" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.label}</td>
                  <td className="muted">{r.workspaceName}</td>
                  <td>
                    <Pill tone={healthTone(r.health)} dot>
                      {HEALTH_LABEL[r.health] ?? r.health}
                    </Pill>
                  </td>
                  <td>
                    {r.setup.ready ? (
                      <Pill tone="good">جاهز</Pill>
                    ) : (
                      <span className="muted">
                        {r.setup.missing.length
                          ? `ينقص ${r.setup.missing.map((action) => INTEGRATION_ACTION_LABEL[action]).join(' و')}`
                          : 'يحتاج إعداد الاتصال'}
                      </span>
                    )}
                  </td>
                  <td className="muted">{r.lastSuccessAt ? relative(r.lastSuccessAt) : '—'}</td>
                  <td className="muted">{r.lastErrorAt ? relative(r.lastErrorAt) : '—'}</td>
                  <td>
                    <IntegrationRowActions
                      id={r.id}
                      label={r.label}
                      capabilities={r.capabilities}
                      endpoints={r.config.endpoints}
                      credentialsRef={r.credentialsRef}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ height: 'var(--s-4)' }} />

      <Section title="تنفيذ الأدوات" meta="آخر 7 أيام" flush>
        {executions.length ? (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الأداة</th>
                  <th>التنفيذات</th>
                  <th>الفاشلة</th>
                  <th>نسبة النجاح</th>
                  <th>زمن الاستجابة p95</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((e) => {
                  const rate = e.total ? Math.round(((e.total - e.failed) / e.total) * 100) : 0
                  return (
                    <tr key={e.toolName}>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {TOOL_LABEL[e.toolName] ?? e.toolName}
                        </span>
                        <br />
                        <code className="mono muted" style={{ fontSize: '0.6875rem' }}>
                          {e.toolName}
                        </code>
                      </td>
                      <td className="mono">{num(e.total)}</td>
                      <td className="mono">{num(e.failed)}</td>
                      <td>
                        <Pill tone={rate >= 99 ? 'good' : rate >= 95 ? 'warn' : 'bad'}>
                          {rate}%
                        </Pill>
                      </td>
                      <td className="mono">{num(e.p95)}ms</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد تنفيذات حقيقية بعد"
            body="ستظهر هنا نتائج أدوات المكالمات الحية فقط بعد بدء استخدامها، دون بيانات تجريبية."
          />
        )}
      </Section>
    </>
  )
}
