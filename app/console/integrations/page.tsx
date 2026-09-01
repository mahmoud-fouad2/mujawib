import type { Metadata } from 'next'
import { IntegrationRowActions } from '@/components/console/infra-actions'
import { ConsoleSearchFilters, CsvExportButton } from '@/components/console/table-tools'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { fullDate, HEALTH_LABEL, healthTone, num, relative, TOOL_LABEL } from '@/lib/format'
import { INTEGRATION_ACTION_LABEL } from '@/lib/integrations'
import { getClientBySlug, getIntegrations } from '@/server/data/console'

export const metadata: Metadata = { title: 'الربط' }
export const dynamic = 'force-dynamic'

type SearchParams = { client?: string; q?: string; status?: string; range?: string }

const INTEGRATION_STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'connected', label: 'متصل' },
  { value: 'degraded', label: 'متذبذب' },
  { value: 'failed', label: 'متوقف' },
  { value: 'disconnected', label: 'غير متصل' },
]

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const search = params.q?.trim() ?? ''
  const status = INTEGRATION_STATUS_OPTIONS.some((option) => option.value === params.status)
    ? (params.status ?? 'all')
    : 'all'
  const range = Object.hasOwn(RANGE_DAYS, params.range ?? '') ? (params.range ?? 'all') : 'all'
  const client = params.client ? await getClientBySlug(params.client) : null
  const { rows: allRows, executions } = await getIntegrations(
    client ? { workspaceId: client.id } : {},
  )
  const cutoffDays = RANGE_DAYS[range]
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null
  const rows = allRows.filter((row) => {
    const q = search.toLowerCase()
    const searchable = [
      row.label,
      row.provider,
      row.workspaceName,
      row.workspaceSlug,
      row.health,
      row.setup.missing.map((action) => INTEGRATION_ACTION_LABEL[action]).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !q || searchable.includes(q)
    const statusMatch = status === 'all' || row.health === status
    const activityDate = row.lastSuccessAt ?? row.lastErrorAt ?? null
    const rangeMatch = !cutoff || (activityDate && new Date(activityDate).getTime() >= cutoff)
    return searchMatch && statusMatch && rangeMatch
  })

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
        sub={
          client
            ? `اتصالات ${client.name}، والأثر الفعلي لتنفيذ الأدوات خلال آخر سبعة أيام`
            : 'حالة كل اتصال، والأثر الفعلي لتنفيذ الأدوات خلال آخر سبعة أيام'
        }
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

      <ConsoleSearchFilters
        basePath="/console/integrations"
        client={params.client}
        search={search}
        status={status}
        range={range}
        searchPlaceholder="ابحث باسم العميل، النظام، أو حالة الربط…"
        statusOptions={INTEGRATION_STATUS_OPTIONS}
      >
        <CsvExportButton
          filename={`mujawib-integrations-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={[
            'النظام',
            'المزوّد',
            'العميل',
            'الحالة',
            'جاهز للتشغيل',
            'النواقص',
            'آخر نجاح',
            'آخر تعثر',
          ]}
          rows={rows.map((row) => [
            row.label,
            row.provider,
            row.workspaceName,
            HEALTH_LABEL[row.health] ?? row.health,
            row.setup.ready ? 'نعم' : 'لا',
            row.setup.missing.map((action) => INTEGRATION_ACTION_LABEL[action]).join(' | '),
            row.lastSuccessAt ? fullDate(row.lastSuccessAt) : '',
            row.lastErrorAt ? fullDate(row.lastErrorAt) : '',
          ])}
        />
      </ConsoleSearchFilters>

      <Section title="الاتصالات" flush>
        {rows.length === 0 ? (
          <EmptyState title="لا نتائج مطابقة" body="غيّر البحث أو الفلاتر لعرض اتصالات أخرى." />
        ) : (
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
                        optionalCapabilities={r.optionalCapabilities}
                        endpoints={r.config.endpoints}
                        credentialsRef={r.credentialsRef}
                        hasStoredCredential={r.hasStoredCredential}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
