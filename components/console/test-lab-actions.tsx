'use client'

import { FlaskConical, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import {
  SCENARIO_CATEGORIES,
  SCENARIO_CATEGORY_LABEL,
  type ScenarioExpectation,
  type ScenarioInput,
  TESTABLE_TOOL_NAMES,
} from '@/lib/test-lab'
import {
  createTestScenario,
  deleteTestScenario,
  runTestScenario,
  runVersionTestSuite,
  updateTestScenario,
} from '@/server/actions/test-lab'

const TOOL_LABEL: Record<(typeof TESTABLE_TOOL_NAMES)[number], string> = {
  check_availability: 'فحص التوفر',
  create_booking: 'إنشاء حجز',
  send_confirmation: 'إرسال تأكيد',
  create_callback: 'تسجيل معاودة اتصال',
  transfer_to_human: 'تحويل لموظف',
}

type ScenarioDraft = {
  name: string
  category: (typeof SCENARIO_CATEGORIES)[number]
  isCritical: boolean
  callerTurns: string
  mustIncludeAny: string
  mustIncludeAll: string
  mustNotInclude: string
  expectedTool: '' | (typeof TESTABLE_TOOL_NAMES)[number]
  forbiddenTools: (typeof TESTABLE_TOOL_NAMES)[number][]
  language: 'ar' | 'en'
  maxWords: string
}

export type EditableScenario = {
  id: string
  name: string
  category: string
  isCritical: boolean
  input: ScenarioInput | null
  expectation: ScenarioExpectation | null
}

const EMPTY_DRAFT: ScenarioDraft = {
  name: '',
  category: 'opening',
  isCritical: true,
  callerTurns: '',
  mustIncludeAny: '',
  mustIncludeAll: '',
  mustNotInclude: '',
  expectedTool: '',
  forbiddenTools: [],
  language: 'ar',
  maxWords: '35',
}

function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function draftFromScenario(scenario: EditableScenario): ScenarioDraft {
  const category = SCENARIO_CATEGORIES.includes(
    scenario.category as (typeof SCENARIO_CATEGORIES)[number],
  )
    ? (scenario.category as (typeof SCENARIO_CATEGORIES)[number])
    : 'opening'
  return {
    ...EMPTY_DRAFT,
    name: scenario.name,
    category,
    isCritical: scenario.isCritical,
    callerTurns: scenario.input?.turns.join('\n') ?? '',
    mustIncludeAny: scenario.expectation?.mustIncludeAny.join('\n') ?? '',
    mustIncludeAll: scenario.expectation?.mustIncludeAll.join('\n') ?? '',
    mustNotInclude: scenario.expectation?.mustNotInclude.join('\n') ?? '',
    expectedTool: scenario.expectation?.expectedTool ?? '',
    forbiddenTools: scenario.expectation?.forbiddenTools ?? [],
    language: scenario.expectation?.language ?? 'ar',
    maxWords: scenario.expectation?.maxWords ? String(scenario.expectation.maxWords) : '',
  }
}

function scenarioContract(draft: ScenarioDraft) {
  return {
    name: draft.name,
    category: draft.category,
    isCritical: draft.isCritical,
    input: { turns: lines(draft.callerTurns) },
    expectation: {
      mustIncludeAny: lines(draft.mustIncludeAny),
      mustIncludeAll: lines(draft.mustIncludeAll),
      mustNotInclude: lines(draft.mustNotInclude),
      expectedTool: draft.expectedTool || null,
      forbiddenTools: draft.forbiddenTools,
      language: draft.language,
      maxWords: draft.maxWords ? Number(draft.maxWords) : null,
    },
  }
}

function hasBusinessExpectation(draft: ScenarioDraft) {
  return Boolean(
    lines(draft.mustIncludeAny).length ||
      lines(draft.mustIncludeAll).length ||
      lines(draft.mustNotInclude).length ||
      draft.expectedTool ||
      draft.forbiddenTools.length,
  )
}

function ScenarioFields({
  prefix,
  draft,
  onChange,
}: {
  prefix: string
  draft: ScenarioDraft
  onChange: (next: ScenarioDraft) => void
}) {
  const set = <Key extends keyof ScenarioDraft>(key: Key, value: ScenarioDraft[Key]) =>
    onChange({ ...draft, [key]: value })

  const toggleForbiddenTool = (tool: (typeof TESTABLE_TOOL_NAMES)[number]) => {
    set(
      'forbiddenTools',
      draft.forbiddenTools.includes(tool)
        ? draft.forbiddenTools.filter((item) => item !== tool)
        : [...draft.forbiddenTools, tool],
    )
  }

  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-name`}>اسم السيناريو</label>
        <input
          id={`${prefix}-name`}
          className="input"
          value={draft.name}
          onChange={(event) => set('name', event.target.value)}
          placeholder="طلب معاينة دون تأكيد وهمي"
        />
      </div>

      <div className="test-lab-form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-category`}>التصنيف</label>
          <select
            id={`${prefix}-category`}
            className="input"
            value={draft.category}
            onChange={(event) =>
              set('category', event.target.value as (typeof SCENARIO_CATEGORIES)[number])
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
            checked={draft.isCritical}
            onChange={(event) => set('isCritical', event.target.checked)}
          />
          <span>
            حرج
            <small>فشله يمنع نشر النسخة.</small>
          </span>
        </label>
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-caller`}>ما يقوله المتصل</label>
        <textarea
          id={`${prefix}-caller`}
          className="input"
          value={draft.callerTurns}
          onChange={(event) => set('callerTurns', event.target.value)}
          placeholder={'أبغى أحجز معاينة بكرة الساعة خمسة\nالمشروع دُرة الشاطئ'}
        />
        <span className="field__hint">كل سطر يمثل دورًا متتابعًا للمتصل، بحد أقصى أربعة.</span>
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-include-any`}>عبارات مقبولة في الرد</label>
        <textarea
          id={`${prefix}-include-any`}
          className="input"
          value={draft.mustIncludeAny}
          onChange={(event) => set('mustIncludeAny', event.target.value)}
          placeholder={'لحظة أتحقق لك\nأقدر أسجل طلبك'}
        />
        <span className="field__hint">عبارة في كل سطر؛ يكفي ظهور واحدة منها.</span>
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-include-all`}>عبارات يجب ظهورها جميعًا</label>
        <textarea
          id={`${prefix}-include-all`}
          className="input"
          value={draft.mustIncludeAll}
          onChange={(event) => set('mustIncludeAll', event.target.value)}
          placeholder="سيتم التأكيد من الفريق"
        />
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-exclude`}>عبارات ممنوعة</label>
        <textarea
          id={`${prefix}-exclude`}
          className="input"
          value={draft.mustNotInclude}
          onChange={(event) => set('mustNotInclude', event.target.value)}
          placeholder={'تم الحجز\nأنا ذكاء اصطناعي'}
        />
      </div>

      <div className="test-lab-form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-tool`}>الإجراء المتوقع</label>
          <select
            id={`${prefix}-tool`}
            className="input"
            value={draft.expectedTool}
            onChange={(event) =>
              set('expectedTool', event.target.value as '' | (typeof TESTABLE_TOOL_NAMES)[number])
            }
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
          <label htmlFor={`${prefix}-language`}>لغة الرد</label>
          <select
            id={`${prefix}-language`}
            className="input"
            value={draft.language}
            onChange={(event) => set('language', event.target.value as 'ar' | 'en')}
          >
            <option value="ar">العربية</option>
            <option value="en">الإنجليزية</option>
          </select>
        </div>
      </div>

      <fieldset className="test-lab-tool-checks">
        <legend>إجراءات ممنوعة في هذا السيناريو</legend>
        {TESTABLE_TOOL_NAMES.map((tool) => (
          <label key={tool} className="check-row">
            <input
              type="checkbox"
              checked={draft.forbiddenTools.includes(tool)}
              onChange={() => toggleForbiddenTool(tool)}
            />
            <span>{TOOL_LABEL[tool]}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor={`${prefix}-length`}>أقصى عدد كلمات في الرد</label>
        <input
          id={`${prefix}-length`}
          className="input"
          type="number"
          min="3"
          max="120"
          value={draft.maxWords}
          onChange={(event) => set('maxWords', event.target.value)}
        />
      </div>
    </>
  )
}

function ScenarioEditorSheet({
  open,
  onClose,
  title,
  description,
  initialDraft,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  initialDraft: ScenarioDraft
  submitLabel: string
  onSubmit: (draft: ScenarioDraft) => ReturnType<typeof createTestScenario>
}) {
  const [draft, setDraft] = useState(initialDraft)
  const { run, pending } = useAction()

  useEffect(() => {
    if (open) setDraft(initialDraft)
  }, [open, initialDraft])

  const valid =
    draft.name.trim().length > 0 &&
    lines(draft.callerTurns).length > 0 &&
    lines(draft.callerTurns).length <= 4 &&
    hasBusinessExpectation(draft)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || !valid}
            onClick={() => run(() => onSubmit(draft), onClose)}
          >
            {pending ? 'جارٍ الحفظ…' : submitLabel}
          </Button>
        </>
      }
    >
      <ScenarioFields
        prefix={title.includes('تعديل') ? 'edit-scenario' : 'new-scenario'}
        draft={draft}
        onChange={setDraft}
      />
    </Sheet>
  )
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
  const { run, pending } = useAction()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

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
      <ScenarioEditorSheet
        open={open}
        onClose={() => setOpen(false)}
        title="سيناريو قابل للقياس"
        description="استخدم بيانات تركيبية. يختبر مُجاوِب نفس نموذج Realtime وتعليمات النسخة دون تنفيذ إجراءات الأعمال."
        initialDraft={EMPTY_DRAFT}
        submitLabel="أضف السيناريو"
        onSubmit={(draft) => createTestScenario({ versionId, ...scenarioContract(draft) })}
      />
    </>
  )
}

export function ScenarioActions({
  scenario,
  openAiConfigured,
}: {
  scenario: EditableScenario
  openAiConfigured: boolean
}) {
  const [editing, setEditing] = useState(false)
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
          onClick={() => run(() => runTestScenario(scenario.id))}
        >
          {pending ? 'يُختبر…' : 'اختبر'}
        </Button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`تعديل ${scenario.name}`}
          onClick={() => setEditing(true)}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`حذف ${scenario.name}`}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <ScenarioEditorSheet
        open={editing}
        onClose={() => setEditing(false)}
        title={`تعديل «${scenario.name}»`}
        description="أي تعديل يبطل نتيجة الاختبار السابقة حتى يُشغّل السيناريو مجددًا."
        initialDraft={draftFromScenario(scenario)}
        submitLabel="احفظ التعديل"
        onSubmit={(draft) =>
          updateTestScenario({ scenarioId: scenario.id, ...scenarioContract(draft) })
        }
      />

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(
            () => deleteTestScenario(scenario.id),
            () => setConfirmDelete(false),
          )
        }
        title={`حذف «${scenario.name}»؟`}
        body="ستُحذف نتائج هذا السيناريو أيضًا، وسيتغير قرار جاهزية النسخة للنشر."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
