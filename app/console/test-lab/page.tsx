import { AlertTriangle, Check, CircleDashed, FlaskConical, X } from 'lucide-react'
import type { Metadata } from 'next'
import { ScenarioActions, TestLabToolbar } from '@/components/console/test-lab-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Button, LinkButton } from '@/components/ui/button'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { num, relative, VERSION_STATUS_LABEL } from '@/lib/format'
import { SCENARIO_CATEGORY_LABEL } from '@/lib/test-lab'
import { getTestLab } from '@/server/data/test-lab'

export const metadata: Metadata = { title: 'مختبر الاختبار' }
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ version?: string | string[] }>
}

function runState(scenario: Awaited<ReturnType<typeof getTestLab>>['scenarios'][number]) {
  const run = scenario.latestRun
  if (!run) return { label: 'لم يُشغّل', tone: 'neutral' as const, icon: CircleDashed }
  if (!run.trusted) return { label: 'نتيجة قديمة', tone: 'warn' as const, icon: AlertTriangle }
  if (!run.fresh) return { label: 'يحتاج إعادة', tone: 'warn' as const, icon: AlertTriangle }
  if (run.passed) return { label: 'ناجح', tone: 'good' as const, icon: Check }
  return {
    label: run.details?.status === 'error' ? 'تعذّر التشغيل' : 'لم ينجح',
    tone: 'bad' as const,
    icon: X,
  }
}

export default async function TestLabPage({ searchParams }: PageProps) {
  const rawVersion = (await searchParams).version
  const requestedVersion = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion
  const data = await getTestLab(requestedVersion)

  return (
    <>
      <PageHead
        title="مختبر الاختبار"
        sub="اختبارات سلوك قابلة للقياس على نفس نموذج Realtime وتعليمات النسخة، قبل أن تصل إلى متصل حقيقي"
        actions={
          <LinkButton href="/console/voice-lab" size="sm">
            مختبر الصوت والنطق
          </LinkButton>
        }
      />

      {data.versions.length > 0 ? (
        <form className="test-lab-version-bar" method="get">
          <label htmlFor="test-version">النسخة تحت الاختبار</label>
          <select
            id="test-version"
            name="version"
            className="input"
            defaultValue={data.selected?.id}
          >
            {data.versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.workspaceName} · {version.agentName} · v{version.versionNumber} ·{' '}
                {VERSION_STATUS_LABEL[version.status] ?? version.status}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            اعرض
          </Button>
        </form>
      ) : null}

      {!data.selected ? (
        <Section title="لا توجد نسخة قابلة للاختبار">
          <EmptyState
            title="أنشئ موظفًا صوتيًا أولًا"
            body="عندما توجد مسودة أو نسخة منشورة ستظهر هنا لبناء حزمة اختبار مرتبطة بها صراحةً."
            action={<LinkButton href="/console/agents">اذهب إلى الموظفين الصوتيين</LinkButton>}
          />
        </Section>
      ) : (
        <>
          <SummaryBar
            items={[
              { label: 'سيناريو', value: num(data.gate?.total ?? 0) },
              { label: 'نتيجة حديثة', value: num(data.gate?.fresh ?? 0) },
              {
                label: 'ناجح',
                value: num(data.gate?.passed ?? 0),
                tone: (data.gate?.passed ?? 0) > 0 ? 'good' : undefined,
              },
              {
                label: 'حرج لم ينجح',
                value: num(data.gate?.criticalFailed ?? 0),
                tone: (data.gate?.criticalFailed ?? 0) > 0 ? 'bad' : undefined,
              },
            ]}
            action={
              <TestLabToolbar
                versionId={data.selected.id}
                scenarioCount={data.scenarios.length}
                openAiConfigured={data.openAiConfigured}
              />
            }
          />

          <div
            className="test-gate"
            data-state={data.gate?.canPublish ? 'ready' : 'blocked'}
            role="status"
          >
            <span className="test-gate__icon">
              {data.gate?.canPublish ? <Check size={17} /> : <AlertTriangle size={17} />}
            </span>
            <div>
              <strong>
                {data.gate?.canPublish
                  ? 'دليل الاختبار صالح للنشر'
                  : 'النسخة لا تجتاز بوابة النشر بعد'}
              </strong>
              <p>
                {data.gate?.canPublish
                  ? 'كل السيناريوهات لها نتائج حديثة، ولا يوجد إخفاق حرج.'
                  : (data.gate?.blockers[0] ?? 'أضف السيناريوهات وشغّل الحزمة.')}
              </p>
            </div>
            <span className="test-gate__version">
              {data.selected.agentName} · v{data.selected.versionNumber} ·{' '}
              {VERSION_STATUS_LABEL[data.selected.status] ?? data.selected.status}
            </span>
          </div>

          {!data.openAiConfigured ? (
            <div className="inline-alert test-lab-env-alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>التشغيل غير مفعّل في هذه البيئة</strong>
                <small>أضف OPENAI_API_KEY إلى بيئة الخادم لتشغيل السيناريوهات الحقيقية.</small>
              </span>
            </div>
          ) : null}

          <Section
            title="سيناريوهات النسخة"
            meta="تشغيل سلوكي نصي على Realtime؛ اختبار الصوت الهاتفي يبقى في مختبر الصوت ومكالمة التحقق"
            flush
          >
            {data.scenarios.length === 0 ? (
              <EmptyState
                title="لا توجد حزمة اختبار بعد"
                body="ابدأ بأكثر القرارات خطورة: التأكيد، التحويل، السعر، والحالات التي يجب فيها الامتناع عن التنفيذ."
              />
            ) : (
              <div className="test-scenarios">
                <div className="test-scenario test-scenario--head" aria-hidden="true">
                  <span>السيناريو</span>
                  <span>آخر نتيجة</span>
                  <span>الدليل</span>
                  <span>الإجراء</span>
                </div>
                {data.scenarios.map((scenario) => {
                  const state = runState(scenario)
                  const StateIcon = state.icon
                  const callerText = scenario.inputContract?.turns[0] ?? 'عقد إدخال قديم'
                  const details = scenario.latestRun?.details
                  return (
                    <article key={scenario.id} className="test-scenario">
                      <div className="test-scenario__identity">
                        <span className="test-scenario__icon">
                          <FlaskConical size={15} />
                        </span>
                        <div>
                          <strong>{scenario.name}</strong>
                          <span>
                            {SCENARIO_CATEGORY_LABEL[
                              scenario.category as keyof typeof SCENARIO_CATEGORY_LABEL
                            ] ?? scenario.category}
                            {scenario.isCritical ? ' · حرج' : ' · مراقبة'}
                          </span>
                        </div>
                      </div>

                      <div className="test-scenario__state">
                        <Pill tone={state.tone}>
                          <StateIcon size={12} aria-hidden="true" />
                          {state.label}
                        </Pill>
                        {scenario.latestRun ? (
                          <span>
                            {scenario.latestRun.score ?? 0}% · {relative(scenario.latestRun.ranAt)}
                          </span>
                        ) : null}
                      </div>

                      <details className="test-evidence">
                        <summary>راجع المدخل والنتيجة</summary>
                        <div className="test-evidence__body">
                          <div>
                            <span>المتصل</span>
                            <p>{callerText}</p>
                          </div>
                          {details?.transcript
                            .filter((turn) => turn.role === 'agent')
                            .map((turn) => (
                              <div key={`${scenario.id}-agent-${turn.text}`}>
                                <span>المُجاوِب</span>
                                <p>{turn.text}</p>
                              </div>
                            ))}
                          {details?.toolCalls.map((tool) => (
                            <div key={`${scenario.id}-tool-${tool.name}-${tool.argumentsJson}`}>
                              <span>إجراء طُلب ولم يُنفّذ</span>
                              <code>{tool.name}</code>
                            </div>
                          ))}
                          {details?.checks.length ? (
                            <ul className="test-checks">
                              {details.checks.map((check) => (
                                <li key={check.id} data-passed={check.passed}>
                                  {check.passed ? <Check size={13} /> : <X size={13} />}
                                  <span>{check.label}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {details?.errorMessage ? (
                            <p className="test-evidence__error">{details.errorMessage}</p>
                          ) : null}
                        </div>
                      </details>

                      <ScenarioActions
                        scenario={{
                          id: scenario.id,
                          name: scenario.name,
                          category: scenario.category,
                          isCritical: scenario.isCritical,
                          input: scenario.inputContract,
                          expectation: scenario.expectationContract,
                        }}
                        openAiConfigured={data.openAiConfigured}
                      />
                    </article>
                  )
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </>
  )
}
