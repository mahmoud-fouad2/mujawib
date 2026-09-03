import type { Metadata } from 'next'
import { ConsoleSearchFilters, CsvExportButton } from '@/components/console/table-tools'
import { AddTemplateButton, TemplateRowActions } from '@/components/console/template-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { fullDate, num } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import { getTemplates } from '@/server/data/console'

export const metadata: Metadata = { title: 'القوالب' }
export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; status?: string; range?: string }

const TEMPLATE_STATUS_OPTIONS = [
  { value: 'all', label: 'كل القوالب' },
  { value: 'in_use', label: 'قيد الاستخدام' },
  { value: 'unused', label: 'غير مستخدم' },
]

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireOperatorPermissionPage('client.manage', '/console/templates')

  const params = await searchParams
  const search = params.q?.trim() ?? ''
  const status = TEMPLATE_STATUS_OPTIONS.some((option) => option.value === params.status)
    ? (params.status ?? 'all')
    : 'all'
  const range = Object.hasOwn(RANGE_DAYS, params.range ?? '') ? (params.range ?? 'all') : 'all'
  const templates = await getTemplates()
  const inUse = templates.filter((t) => t.clients > 0).length
  const flows = templates.reduce(
    (s, t) => s + ((t.defaultFlows as unknown[]) ?? []).filter(Boolean).length,
    0,
  )
  const cutoffDays = RANGE_DAYS[range]
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null
  const rows = templates.filter((t) => {
    const q = search.toLowerCase()
    const schema = (t.knowledgeSchema ?? {}) as { fields?: Record<string, string[]> }
    const searchable = [
      t.name,
      t.packKey,
      t.version,
      ...((t.defaultFlows as string[]) ?? []).filter(Boolean),
      ...((t.defaultIntegrations as string[]) ?? []).filter(Boolean),
      ...Object.values(schema.fields ?? {}).flat(),
    ]
      .join(' ')
      .toLowerCase()
    const statusMatch =
      status === 'all' ||
      (status === 'in_use' && t.clients > 0) ||
      (status === 'unused' && t.clients === 0)
    const rangeMatch = !cutoff || new Date(t.createdAt).getTime() >= cutoff
    return statusMatch && (!q || searchable.includes(q)) && rangeMatch
  })

  return (
    <>
      <PageHead
        title="قوالب القطاعات"
        sub="أربع حزم مدعومة بالكامل — كل حزمة تحمل مخطط معرفتها ومساراتها وحزمة اختبارها"
        actions={<AddTemplateButton />}
      />

      <SummaryBar
        items={[
          { label: 'قالب', value: num(templates.length) },
          { label: 'قيد الاستخدام', value: num(inUse), tone: 'good' },
          { label: 'مسار جاهز', value: num(flows) },
          { label: 'شركة مشغَّلة', value: num(templates.reduce((s, t) => s + t.clients, 0)) },
        ]}
      />

      <ConsoleSearchFilters
        basePath="/console/templates"
        search={search}
        status={status}
        range={range}
        searchPlaceholder="ابحث باسم القالب، المفتاح، المسار، أو حقول السكيما…"
        statusOptions={TEMPLATE_STATUS_OPTIONS}
      >
        <CsvExportButton
          filename={`mujawib-templates-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={[
            'القالب',
            'المفتاح',
            'النسخة',
            'شركات تستخدمه',
            'المسارات',
            'التكاملات',
            'سيناريوهات الاختبار',
            'أُنشئ في',
          ]}
          rows={rows.map((t) => [
            t.name,
            t.packKey,
            t.version,
            t.clients,
            ((t.defaultFlows as string[]) ?? []).join(' | '),
            ((t.defaultIntegrations as string[]) ?? []).join(' | '),
            ((t.qaSuite as string[]) ?? []).join(' | '),
            fullDate(t.createdAt),
          ])}
        />
      </ConsoleSearchFilters>

      <Section title="الحزم" flush>
        {templates.length === 0 ? (
          <EmptyState
            title="لا قوالب بعد"
            body="قوالب القطاعات هي أساس تهيئة عميل جديد — أضف قالبًا ليظهر هنا."
          />
        ) : rows.length === 0 ? (
          <EmptyState title="لا نتائج مطابقة" body="غيّر البحث أو الفلاتر لعرض قوالب أخرى." />
        ) : (
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
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
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
                      <td>
                        <TemplateRowActions template={t} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
