import type { Metadata } from 'next'
import Link from 'next/link'
import { AgentRowActions } from '@/components/console/agent-actions'
import { AgentCreateSheet } from '@/components/console/agent-create'
import { ConsoleSearchFilters, CsvExportButton } from '@/components/console/table-tools'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { fullDate, num, relative, VERSION_STATUS_LABEL } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import { getAgentCreationOptions, getAgents, getClientBySlug } from '@/server/data/console'

export const metadata: Metadata = { title: 'الموظفون الصوتيون' }
export const dynamic = 'force-dynamic'

type SearchParams = { client?: string; q?: string; status?: string; range?: string }

const AGENT_STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'published', label: 'لديه نسخة منشورة' },
  { value: 'no_live', label: 'لم ينشر بعد' },
  { value: 'draft', label: 'لديه مسودة' },
  { value: 'ready', label: 'جاهز للنشر' },
  { value: 'blocked', label: 'نشره محجوب' },
]

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireOperatorPermissionPage('agent.publish', '/console/agents')

  const params = await searchParams
  const search = params.q?.trim() ?? ''
  const status = AGENT_STATUS_OPTIONS.some((option) => option.value === params.status)
    ? (params.status ?? 'all')
    : 'all'
  const range = Object.hasOwn(RANGE_DAYS, params.range ?? '') ? (params.range ?? 'all') : 'all'
  const client = params.client ? await getClientBySlug(params.client) : null
  const [{ rows: agents, total }, creationOptions] = await Promise.all([
    getAgents(client ? { workspaceId: client.id } : {}),
    getAgentCreationOptions(),
  ])

  const cutoffDays = RANGE_DAYS[range]
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null
  const rows = agents.filter((a) => {
    const blockers = a.draftTestGate?.blockers ?? []
    const hasDraft = Boolean(a.draft)
    const isPublished = a.live?.status === 'published'
    const ready = Boolean(a.draft && a.draftTestGate?.canPublish)
    const stateMatch =
      status === 'all' ||
      (status === 'published' && isPublished) ||
      (status === 'no_live' && !isPublished) ||
      (status === 'draft' && hasDraft) ||
      (status === 'ready' && ready) ||
      (status === 'blocked' && hasDraft && blockers.length > 0)
    const q = search.toLowerCase()
    const searchable = [
      a.name,
      a.workspaceName,
      a.workspaceSlug,
      a.voiceProfile?.name,
      a.live?.status,
      a.draft ? `v${a.draft.versionNumber}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !q || searchable.includes(q)
    const rangeMatch = !cutoff || new Date(a.updatedAt).getTime() >= cutoff
    return stateMatch && searchMatch && rangeMatch
  })

  const published = rows.filter((a) => a.live?.status === 'published').length
  const blocked = rows.filter((a) => a.draft && !a.draftTestGate?.canPublish).length
  const readyToPublish = rows.filter((a) => a.draft && a.draftTestGate?.canPublish).length
  const truncated = total > agents.length

  return (
    <>
      <PageHead
        title="الموظفون الصوتيون"
        sub={
          client
            ? `موظفو ${client.name} الصوتيون`
            : 'النسخة التي تعمل الآن، والمسودة التالية، وما يمنعها من النشر'
        }
        actions={
          <AgentCreateSheet
            clients={creationOptions.clients}
            profiles={creationOptions.profiles}
            initialWorkspaceId={client?.id}
          />
        }
      />

      <SummaryBar
        items={[
          { label: 'موظف صوتي', value: num(total) },
          { label: 'نسخة منشورة', value: num(published), tone: 'good' },
          {
            label: 'جاهزة للنشر',
            value: num(readyToPublish),
            tone: readyToPublish > 0 ? 'good' : undefined,
          },
          { label: 'مسودة محجوبة', value: num(blocked), tone: blocked > 0 ? 'warn' : undefined },
        ]}
      />

      <ConsoleSearchFilters
        basePath="/console/agents"
        client={params.client}
        search={search}
        status={status}
        range={range}
        searchPlaceholder="ابحث باسم الموظف، العميل، أو ملف الصوت…"
        statusOptions={AGENT_STATUS_OPTIONS}
      >
        <CsvExportButton
          filename={`mujawib-agents-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={[
            'الموظف الصوتي',
            'العميل',
            'النسخة المنشورة',
            'الجاهزية',
            'ملف الصوت',
            'المسودة',
            'حواجز النشر',
            'آخر تحديث',
          ]}
          rows={rows.map((a) => [
            a.name,
            a.workspaceName,
            a.live
              ? `v${a.live.versionNumber} ${VERSION_STATUS_LABEL[a.live.status] ?? a.live.status}`
              : '',
            `${a.live?.readinessScore ?? 0}%`,
            a.voiceProfile?.name ?? '',
            a.draft ? `v${a.draft.versionNumber}` : '',
            (a.draftTestGate?.blockers ?? []).join(' | '),
            fullDate(a.updatedAt),
          ])}
        />
      </ConsoleSearchFilters>

      <Section
        title="كل الموظفين"
        meta={
          rows.length !== agents.length
            ? `${num(rows.length)} نتيجة من ${num(agents.length)} معروض`
            : truncated
              ? `تعرض أول ${num(agents.length)} من ${num(total)} موظف`
              : undefined
        }
        flush
      >
        {rows.length === 0 ? (
          <EmptyState
            title="لا نتائج مطابقة"
            body="غيّر البحث أو الفلاتر لعرض موظفين صوتيين آخرين."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>العميل</th>
                  <th>تعمل الآن</th>
                  <th>الجاهزية</th>
                  <th>ملف الصوت</th>
                  <th>المسودة</th>
                  <th>ما يمنع النشر</th>
                  <th>آخر تحديث</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const blockers = a.draftTestGate?.blockers ?? []
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/console/agents/${a.id}`}>{a.name}</Link>
                      </td>
                      <td className="muted">{a.workspaceName}</td>
                      <td>
                        {a.live ? (
                          <span className="row" style={{ gap: 'var(--s-2)' }}>
                            <span className="mono">v{a.live.versionNumber}</span>
                            <Pill tone={a.live.status === 'published' ? 'good' : 'neutral'}>
                              {VERSION_STATUS_LABEL[a.live.status] ?? a.live.status}
                            </Pill>
                          </span>
                        ) : (
                          <Pill tone="warn">لم تُنشر بعد</Pill>
                        )}
                      </td>
                      <td className="mono">{a.live?.readinessScore ?? 0}%</td>
                      <td className="muted">{a.voiceProfile?.name ?? '—'}</td>
                      <td className="mono">{a.draft ? `v${a.draft.versionNumber}` : '—'}</td>
                      <td>
                        {blockers.length > 0 ? (
                          <Pill tone="warn">{blockers[0]}</Pill>
                        ) : a.draft ? (
                          <Pill tone="good">جاهزة</Pill>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted">{relative(a.updatedAt)}</td>
                      <td>
                        <AgentRowActions
                          agentId={a.id}
                          agentName={a.name}
                          draftVersionId={a.draft?.id ?? null}
                          draftNumber={a.draft?.versionNumber ?? null}
                          blockers={blockers}
                          canRollback={a.versionCount > 1 && Boolean(a.liveVersionId)}
                          isPublished={a.live?.status === 'published'}
                        />
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
