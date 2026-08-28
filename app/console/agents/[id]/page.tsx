import { ArrowLeft, Check, X } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentRowActions } from '@/components/console/agent-actions'
import { AgentEditorSheet } from '@/components/console/agent-editor'
import { Ratio } from '@/components/console/charts'
import { KnowledgeManager } from '@/components/console/knowledge-manager'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { fullDate, num, relative, VERSION_STATUS_LABEL } from '@/lib/format'
import { getAgentDetail } from '@/server/data/console'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getAgentDetail((await params).id)
  return { title: detail?.name ?? 'موظف صوتي' }
}

const STYLE_LABEL: Record<string, string> = {
  professional: 'احترافي',
  warm: 'ودود',
  concise: 'موجز',
  premium: 'راقٍ',
}

export default async function AgentDetailPage({ params }: Props) {
  const a = await getAgentDetail((await params).id)
  if (!a) notFound()

  const blockers = a.draftTestGate?.blockers ?? []
  const criticalFailed = a.runs.filter((r) => !r.passed && r.isCritical)
  const passed = a.runs.filter((r) => r.passed).length
  const passRate = a.runs.length ? Math.round((passed / a.runs.length) * 100) : 0
  const identity = (a.liveVersion?.identity ?? {}) as {
    role?: string
    goals?: string[]
    restricted?: string[]
  }

  return (
    <>
      <div className="detail-back">
        <Link href="/console/agents" className="btn btn--quiet btn--sm">
          <ArrowLeft size={14} className="arrow" aria-hidden="true" />
          كل الموظفين
        </Link>
      </div>

      <PageHead
        title={a.name}
        sub={
          <>
            <Link href={`/console/clients/${a.workspaceSlug}`}>{a.workspaceName}</Link>
            {a.liveVersion ? ` · تعمل الآن v${a.liveVersion.versionNumber}` : ' · لم تُنشر بعد'}
          </>
        }
        actions={
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            {a.draft ? (
              <AgentEditorSheet
                agentId={a.id}
                agentName={a.name}
                draftVersion={{
                  id: a.draft.id,
                  versionNumber: a.draft.versionNumber,
                  voiceProfileId: a.draft.voiceProfileId,
                  identity:
                    (a.draft.identity as {
                      role?: string
                      goals?: string[]
                      restricted?: string[]
                    } | null) ?? null,
                  businessRules:
                    (a.draft.businessRules as { hours?: string; transferTo?: string } | null) ??
                    null,
                  routing:
                    (a.draft.routing as { afterHours?: string; escalation?: string } | null) ??
                    null,
                  flows: (a.draft.flows as string[] | null) ?? null,
                  toolBindings: (a.draft.toolBindings as string[] | null) ?? null,
                }}
                voiceProfiles={a.allVoiceProfiles.map((p) => ({
                  id: p.id,
                  name: p.name,
                  dialect: p.dialect,
                  style: p.style,
                }))}
                integrations={a.integrations}
              />
            ) : null}
            <AgentRowActions
              agentId={a.id}
              agentName={a.name}
              draftVersionId={a.draft?.id ?? null}
              draftNumber={a.draft?.versionNumber ?? null}
              blockers={blockers}
              canRollback={a.versions.length > 1 && Boolean(a.liveVersionId)}
              isPublished={a.liveVersion?.status === 'published'}
              deleteRedirectTo="/console/agents"
            />
          </div>
        }
      />

      <SummaryBar
        items={[
          { label: 'مكالمة خلال 30 يومًا', value: num(a.stats.calls) },
          { label: 'أُغلقت بدون تدخل', value: `${a.stats.resolvedRate}%`, tone: 'good' },
          {
            label: 'اجتياز السيناريوهات',
            value: `${passRate}%`,
            tone: passRate >= 90 ? 'good' : 'warn',
          },
          ...(criticalFailed.length
            ? [
                {
                  label: 'سيناريو حرج فاشل — يمنع النشر',
                  value: num(criticalFailed.length),
                  tone: 'bad' as const,
                },
              ]
            : []),
        ]}
      />

      <div className="split">
        <Section
          title="الهوية والسلوك"
          meta={a.liveVersion ? `v${a.liveVersion.versionNumber}` : undefined}
        >
          {a.liveVersion ? (
            <div className="stack">
              <p style={{ fontSize: 'var(--step--1)', lineHeight: 1.75 }}>{identity.role}</p>

              {identity.goals?.length ? (
                <div>
                  <div className="detail-section-label" style={{ padding: 0 }}>
                    ما يفعله
                  </div>
                  <ul
                    className="prose"
                    style={{ gap: 'var(--s-2)', marginBlockStart: 'var(--s-2)' }}
                  >
                    {identity.goals.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {identity.restricted?.length ? (
                <div>
                  <div className="detail-section-label" style={{ padding: 0 }}>
                    ما لا يفعله
                  </div>
                  <ul
                    className="prose"
                    style={{ gap: 'var(--s-2)', marginBlockStart: 'var(--s-2)' }}
                  >
                    {identity.restricted.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {a.voiceProfile ? (
                <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                  <Pill tone="signal">{a.voiceProfile.name}</Pill>
                  <Pill>{STYLE_LABEL[a.voiceProfile.style] ?? a.voiceProfile.style}</Pill>
                  <Pill>{a.voiceProfile.dialect}</Pill>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="لا نسخة منشورة" body="لم تُنشر أي نسخة من هذا الموظف بعد." />
          )}
        </Section>

        <Section title="الجاهزية">
          <div className="ratio-row">
            <Ratio
              value={a.liveVersion?.readinessScore ?? a.draft?.readinessScore ?? 0}
              label="درجة الجاهزية"
              tone={blockers.length > 0 ? 'warn' : 'good'}
            />
            <div className="ratio-row__note">
              {blockers.length > 0 ? (
                <>
                  <p>لا يمكن نشر المسودة قبل رفع ما يلي:</p>
                  <div className="queue__flags">
                    {blockers.map((b) => (
                      <Pill key={b} tone="warn">
                        {b}
                      </Pill>
                    ))}
                  </div>
                </>
              ) : a.draft ? (
                <p>المسودة v{a.draft.versionNumber} جاهزة للنشر — لا حواجز مفتوحة.</p>
              ) : (
                <p>لا توجد مسودة قيد الإعداد.</p>
              )}
            </div>
          </div>
        </Section>
      </div>

      <div className="split">
        <Section title="المسارات" meta={`${num(a.flows.length)}`} flush>
          {a.flows.length === 0 ? (
            <EmptyState title="لا مسارات" body="لم تُضبط مسارات لهذه النسخة." />
          ) : (
            <div className="queue">
              {a.flows.map((f) => (
                <div key={f.id} className="queue__row">
                  <div>
                    <div className="queue__title">{f.name}</div>
                    <div className="queue__meta">
                      {((f.requiredFields ?? []) as string[]).join(' · ') || '—'}
                    </div>
                  </div>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {((f.actions ?? []) as string[]).length} إجراء
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="حزمة الاختبار" meta={`${num(passed)} من ${num(a.runs.length)}`} flush>
          {a.runs.length === 0 ? (
            <EmptyState title="لم تُشغَّل الاختبارات" body="لا نتائج بعد لهذه النسخة." />
          ) : (
            <div className="queue">
              {a.runs.map((r) => (
                <div key={r.name} className="queue__row">
                  <div>
                    <div className="queue__title">{r.name}</div>
                    <div className="queue__meta">
                      <span>{r.category}</span>
                      {r.isCritical ? <Pill tone="warn">حرج</Pill> : null}
                    </div>
                  </div>
                  <span className="row" style={{ gap: 'var(--s-2)' }}>
                    <span className="mono muted">{r.score}</span>
                    {r.passed ? (
                      <Check size={15} style={{ color: 'var(--good)' }} aria-hidden="true" />
                    ) : (
                      <X size={15} style={{ color: 'var(--bad)' }} aria-hidden="true" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="معرفة العمل والخدمات والسياسات" meta={`${num(a.knowledge.length)} عنصر مسجّل`}>
        <KnowledgeManager
          workspaceId={a.workspaceId}
          items={a.knowledge.map((k) => ({
            id: k.id,
            category: k.category,
            title: k.title,
            content: k.content as Record<string, unknown>,
            createdAt: k.createdAt,
          }))}
        />
      </Section>

      <Section title="تاريخ النسخ" meta={`${num(a.versions.length)} نسخة`} flush>
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>النسخة</th>
                <th>الحالة</th>
                <th>الجاهزية</th>
                <th>الحواجز</th>
                <th>نُشرت</th>
                <th>أُنشئت</th>
              </tr>
            </thead>
            <tbody>
              {a.versions.map((v) => {
                return (
                  <tr key={v.id}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      v{v.versionNumber}
                      {v.id === a.liveVersionId ? (
                        <>
                          {' '}
                          <Pill tone="good">تعمل</Pill>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <Pill tone={v.status === 'published' ? 'good' : 'neutral'}>
                        {VERSION_STATUS_LABEL[v.status] ?? v.status}
                      </Pill>
                    </td>
                    <td className="mono">{v.readinessScore ?? 0}%</td>
                    <td className="muted">{v.status === 'draft' ? (blockers[0] ?? '—') : '—'}</td>
                    <td className="muted">{v.publishedAt ? fullDate(v.publishedAt) : '—'}</td>
                    <td className="muted">{relative(v.createdAt)}</td>
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
