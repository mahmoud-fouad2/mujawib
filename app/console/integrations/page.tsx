import type { Metadata } from 'next'
import { IntegrationRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import { HEALTH_LABEL, healthTone, num, relative, TOOL_LABEL } from '@/lib/format'
import { getIntegrations } from '@/server/data/console'

export const metadata: Metadata = { title: 'الربط' }
export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const { rows, executions } = await getIntegrations()

  const connected = rows.filter((r) => r.health === 'connected').length
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
          { label: `اتصال سليم من ${num(rows.length)}`, value: num(connected), tone: 'good' },
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
                <th>آخر نجاح</th>
                <th>آخر خطأ</th>
                <th>نسبة الأخطاء 24س</th>
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
                  <td className="muted">{r.lastSuccessAt ? relative(r.lastSuccessAt) : '—'}</td>
                  <td className="muted">{r.lastErrorAt ? relative(r.lastErrorAt) : '—'}</td>
                  <td className="mono">{r.errorRate24h ?? '0%'}</td>
                  <td>
                    <IntegrationRowActions id={r.id} label={r.label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ height: 'var(--s-4)' }} />

      <Section title="تنفيذ الأدوات" meta="آخر 7 أيام" flush>
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
                      <Pill tone={rate >= 99 ? 'good' : rate >= 95 ? 'warn' : 'bad'}>{rate}%</Pill>
                    </td>
                    <td className="mono">{num(e.p95)}ms</td>
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
