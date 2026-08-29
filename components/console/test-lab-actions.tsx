'use client'

import { FlaskConical, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { SCENARIO_CATEGORIES, SCENARIO_CATEGORY_LABEL, TESTABLE_TOOL_NAMES } from '@/lib/test-lab'
import {
  createTestScenario,
  deleteTestScenario,
  runTestScenario,
  runVersionTestSuite,
} from '@/server/actions/test-lab'

const TOOL_LABEL: Record<(typeof TESTABLE_TOOL_NAMES)[number], string> = {
  check_availability: 'فحص التوفر',
  create_booking: 'إنشاء حجز',
  send_confirmation: 'إرسال تأكيد',
  create_callback: 'تسجيل معاودة اتصال',
  transfer_to_human: 'تحويل لموظف',
}

function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function TestLabToolbar({
  versionId,
  scenarioCount,
  openAiConfigured,
}: {
  versionId: string
  scenarioCount: number
  openAiConfigured: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof SCENARIO_CATEGORIES)[number]>('opening')
  const [critical, setCritical] = useState(true)
  const [callerText, setCallerText] = useState('')
  const [mustIncludeAny, setMustIncludeAny] = useState('')
  const [mustNotInclude, setMustNotInclude] = useState('')
  const [expectedTool, setExpectedTool] = useState('')
  const [language, setLanguage] = useState<'ar' | 'en'>('ar')
  const [maxWords, setMaxWords] = useState('35')
  const { run, pending } = useAction()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // A suite run is 12 scenarios at 2-way concurrency, each a real Realtime
  // call — well past a minute isn't unusual. The only feedback used to be a
  // static "جارٍ التشغيل…" the whole time, no different from a stuck button.
  useEffect(() => {
    if (!pending) {
      setElapsedSeconds(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  // language/maxWords are always present (a <select> and a defaulted input,
  // neither can go empty the way the three checks below can) — including
  // them here made this true unconditionally, silently defeating the "must
  // specify at least one real assertion" rule the disabled state below relies on.
  const hasExpectation = Boolean(
    lines(mustIncludeAny).length || lines(mustNotInclude).length || expectedTool,
  )

  function reset() {
    setName('')
    setCallerText('')
    setMustIncludeAny('')
    setMustNotInclude('')
    setExpectedTool('')
    setCritical(true)
  }

  return (
    <>
      <div className="test-lab-actions">
        <Button size="sm" leading={<Plus size={15} />} onClick={() => setOpen(true)}>
          سيناريو جديد
        </Button>
        <Button
          variant="primary"
          size="sm"
          leading={<Play size={15} />}
          disabled={pending || scenarioCount === 0 || !openAiConfigured || scenarioCount > 12}
          title={
            !openAiConfigured
              ? 'تشغيل Realtime غير مفعّل في هذه البيئة'
              : scenarioCount > 12
                ? 'قسّم الحزمة إلى 12 سيناريو أو أقل للتشغيل التفاعلي'
                : undefined
          }
          onClick={() => run(() => runVersionTestSuite(versionId))}
        >
          {pending ? `جارٍ التشغيل… ${elapsedSeconds} ث` : 'شغّل الحزمة'}
        </Button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="سيناريو قابل للقياس"
        description="استخدم بيانات تركيبية. سيختبر المُجاوِب على نفس نموذج Realtime وتعليمات النسخة، دون تنفيذ إجراءات الأعمال."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || !name.trim() || !callerText.trim() || !hasExpectation}
              onClick={() =>
                run(
                  () =>
                    createTestScenario({
                      versionId,
                      name,
                      category,
                      isCritical: critical,
                      input: { turns: [callerText] },
                      expectation: {
                        mustIncludeAny: lines(mustIncludeAny),
                        mustIncludeAll: [],
                        mustNotInclude: lines(mustNotInclude),
                        expectedTool: expectedTool
                          ? (expectedTool as (typeof TESTABLE_TOOL_NAMES)[number])
                          : null,
                        forbiddenTools: [],
                        language,
                        maxWords: maxWords ? Number(maxWords) : null,
                      },
                    }),
                  () => {
                    setOpen(false)
                    reset()
                  },
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'أضف السيناريو'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="scenario-name">اسم السيناريو</label>
          <input
            id="scenario-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="طلب موعد دون تأكيد وهمي"
          />
        </div>

        <div className="test-lab-form-grid">
          <div className="field">
            <label htmlFor="scenario-category">التصنيف</label>
            <select
              id="scenario-category"
              className="input"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as (typeof SCENARIO_CATEGORIES)[number])
              }
            >
              {SCENARIO_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {SCENARIO_CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <label className="check-row test-lab-critical">
            <input
              type="checkbox"
              checked={critical}
              onChange={(event) => setCritical(event.target.checked)}
            />
            <span>
              حرج
              <small>فشله يمنع نشر النسخة.</small>
            </span>
          </label>
        </div>

        <div className="field">
          <label htmlFor="scenario-caller">ما يقوله المتصل</label>
          <textarea
            id="scenario-caller"
            className="input"
            value={callerText}
            onChange={(event) => setCallerText(event.target.value)}
            placeholder="أبغى أحجز بكرة الساعة خمسة"
          />
        </div>

        <div className="field">
          <label htmlFor="scenario-include">عبارات مقبولة في الرد</label>
          <textarea
            id="scenario-include"
            className="input"
            value={mustIncludeAny}
            onChange={(event) => setMustIncludeAny(event.target.value)}
            placeholder={'لحظة أتحقق لك\nأسجل طلبك'}
          />
          <span className="field__hint">عبارة في كل سطر؛ يكفي ظهور واحدة منها.</span>
        </div>

        <div className="field">
          <label htmlFor="scenario-exclude">عبارات ممنوعة</label>
          <textarea
            id="scenario-exclude"
            className="input"
            value={mustNotInclude}
            onChange={(event) => setMustNotInclude(event.target.value)}
            placeholder={'تم الحجز\nأنا ذكاء اصطناعي'}
          />
        </div>

        <div className="test-lab-form-grid">
          <div className="field">
            <label htmlFor="scenario-tool">الإجراء المتوقع</label>
            <select
              id="scenario-tool"
              className="input"
              value={expectedTool}
              onChange={(event) => setExpectedTool(event.target.value)}
            >
              <option value="">لا إجراء</option>
              {TESTABLE_TOOL_NAMES.map((tool) => (
                <option key={tool} value={tool}>
                  {TOOL_LABEL[tool]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scenario-language">لغة الرد</label>
            <select
              id="scenario-language"
              className="input"
              value={language}
              onChange={(event) => setLanguage(event.target.value as 'ar' | 'en')}
            >
              <option value="ar">العربية</option>
              <option value="en">الإنجليزية</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="scenario-length">أقصى عدد كلمات في الرد</label>
          <input
            id="scenario-length"
            className="input"
            type="number"
            min="3"
            max="120"
            value={maxWords}
            onChange={(event) => setMaxWords(event.target.value)}
          />
        </div>
      </Sheet>
    </>
  )
}

export function ScenarioActions({
  scenarioId,
  scenarioName,
  openAiConfigured,
}: {
  scenarioId: string
  scenarioName: string
  openAiConfigured: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <div className="test-lab-row-actions">
        <Button
          size="sm"
          variant="quiet"
          leading={<FlaskConical size={14} />}
          disabled={pending || !openAiConfigured}
          title={openAiConfigured ? undefined : 'تشغيل Realtime غير مفعّل في هذه البيئة'}
          onClick={() => run(() => runTestScenario(scenarioId))}
        >
          {pending ? 'يُختبر…' : 'اختبر'}
        </Button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`حذف ${scenarioName}`}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(
            () => deleteTestScenario(scenarioId),
            () => setConfirmDelete(false),
          )
        }
        title={`حذف «${scenarioName}»؟`}
        body="ستُحذف نتائج هذا السيناريو أيضًا، وسيتغير قرار جاهزية النسخة للنشر."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
