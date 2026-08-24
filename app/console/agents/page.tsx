import type { Metadata } from 'next'
import Link from 'next/link'
import { AgentRowActions } from '@/components/console/agent-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import { num, relative, VERSION_STATUS_LABEL } from '@/lib/format'
import { getAgents } from '@/server/data/console'

export const metadata: Metadata = { title: 'الموظفون الصوتيون' }
export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const agents = await getAgents()

  const published = agents.filter((a) => a.live?.status === 'published').length
  const blocked = agents.filter((a) => a.draft && !a.draftTestGate?.canPublish).length
  const readyToPublish = agents.filter((a) => a.draft && a.draftTestGate?.canPublish).length

  return (
    <>
      <PageHead
        title="الموظفون الصوتيون"
        sub="النسخة التي تعمل الآن، والمسودة التالية، وما يمنعها من النشر"
      />

      <SummaryBar
        items={[
          { label: 'موظف صوتي', value: num(agents.length) },
          { label: 'نسخة منشورة', value: num(published), tone: 'good' },
          {
            label: 'جاهزة للنشر',
            value: num(readyToPublish),
            tone: readyToPublish > 0 ? 'good' : undefined,
          },
          { label: 'مسودة محجوبة', value: num(blocked), tone: blocked > 0 ? 'warn' : undefined },
        ]}
      />

      <Section title="كل الموظفين" flush>
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
              {agents.map((a) => {
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
      </Section>
    </>
  )
}
