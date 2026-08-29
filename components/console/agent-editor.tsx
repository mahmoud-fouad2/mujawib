'use client'

import { Edit3, Plug, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { Pill } from '@/components/ui/primitives'
import { useAction } from '@/components/ui/row-actions'
import { updateAgentDraft } from '@/server/actions/console'

type IntegrationOption = {
  id: string
  provider: string
  label: string
  health: string
}

type VoiceProfileOption = {
  id: string
  name: string
  dialect: string
  style: string
}

export type AgentEditorProps = {
  agentId: string
  agentName: string
  draftVersion: {
    id: string
    versionNumber: number
    voiceProfileId: string | null
    identity: {
      role?: string
      goals?: string[]
      restricted?: string[]
    } | null
    businessRules: {
      hours?: string
      transferTo?: string
    } | null
    routing: {
      afterHours?: string
      escalation?: string
    } | null
    flows: string[] | null
    toolBindings: string[] | null
    voiceCancellationEnabled: boolean
  }
  voiceProfiles: VoiceProfileOption[]
  integrations: IntegrationOption[]
  /** The real flow rows the compiled prompt actually uses — see the note by the Flows section below. */
  structuredFlows: { id: string; name: string; goal: string }[]
}

export function AgentEditorSheet({
  agentId,
  agentName: initialName,
  draftVersion,
  voiceProfiles,
  integrations,
  structuredFlows,
}: AgentEditorProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [voiceProfileId, setVoiceProfileId] = useState(
    draftVersion.voiceProfileId ?? voiceProfiles[0]?.id ?? '',
  )
  const [role, setRole] = useState(draftVersion.identity?.role ?? '')
  const [goals, setGoals] = useState<string[]>(draftVersion.identity?.goals ?? [])
  const [restricted, setRestricted] = useState<string[]>(draftVersion.identity?.restricted ?? [])
  const [hours, setHours] = useState(draftVersion.businessRules?.hours ?? '')
  const [transferTo, setTransferTo] = useState(draftVersion.businessRules?.transferTo ?? '')
  const [afterHours, setAfterHours] = useState(draftVersion.routing?.afterHours ?? 'callback')
  const [flows, setFlows] = useState<string[]>(
    draftVersion.flows?.length
      ? draftVersion.flows
      : ['حجز موعد', 'استفسار عن الخدمات', 'تحويل لموظف'],
  )
  const [bindings, setBindings] = useState<Set<string>>(new Set(draftVersion.toolBindings ?? []))
  const [voiceCancellationEnabled, setVoiceCancellationEnabled] = useState(
    draftVersion.voiceCancellationEnabled,
  )

  const [newGoal, setNewGoal] = useState('')
  const [newRestricted, setNewRestricted] = useState('')
  const [newFlow, setNewFlow] = useState('')

  const { run, pending } = useAction()

  const hasCalendarBinding = [...bindings].some(
    (b) =>
      b.includes('calendar') ||
      b.includes('microsoft') ||
      b.includes('rest_api') ||
      b.includes('generic_api'),
  )

  const handleSave = () => {
    run(
      () =>
        updateAgentDraft({
          agentId,
          versionId: draftVersion.id,
          agentName: name,
          voiceProfileId,
          identity: {
            role,
            goals: goals.filter(Boolean),
            restricted: restricted.filter(Boolean),
          },
          businessRules: {
            hours,
            transferTo,
          },
          routing: {
            afterHours,
            escalation: transferTo,
          },
          flows: flows.filter(Boolean),
          toolBindings: [...bindings],
          voiceCancellationEnabled: hasCalendarBinding && voiceCancellationEnabled,
        }),
      () => setOpen(false),
    )
  }

  const toggleBinding = (provider: string) => {
    setBindings((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  const addGoal = () => {
    if (!newGoal.trim() || goals.includes(newGoal.trim())) return
    setGoals((prev) => [...prev, newGoal.trim()])
    setNewGoal('')
  }

  const removeGoal = (target: string) => {
    setGoals((prev) => prev.filter((g) => g !== target))
  }

  const addRestricted = () => {
    if (!newRestricted.trim() || restricted.includes(newRestricted.trim())) return
    setRestricted((prev) => [...prev, newRestricted.trim()])
    setNewRestricted('')
  }

  const removeRestricted = (target: string) => {
    setRestricted((prev) => prev.filter((r) => r !== target))
  }

  const addFlow = () => {
    if (!newFlow.trim() || flows.includes(newFlow.trim())) return
    setFlows((prev) => [...prev, newFlow.trim()])
    setNewFlow('')
  }

  const removeFlow = (target: string) => {
    setFlows((prev) => prev.filter((f) => f !== target))
  }

  const [pendingBlueprint, setPendingBlueprint] = useState<
    'clinic' | 'realestate' | 'auto' | 'salon' | null
  >(null)
  // flows is excluded: an untouched draft already carries a non-empty
  // placeholder list there, so it would read as "customized" even when
  // nothing has actually been written yet.
  const hasCustomization = Boolean(role.trim()) || goals.length > 0 || restricted.length > 0

  const requestBlueprint = (type: 'clinic' | 'realestate' | 'auto' | 'salon') => {
    if (hasCustomization) setPendingBlueprint(type)
    else applyBlueprint(type)
  }

  const applyBlueprint = (type: 'clinic' | 'realestate' | 'auto' | 'salon') => {
    if (type === 'clinic') {
      setName('سارة — العيادة الطبية')
      setRole(
        'موظفة استقبال عيادات طبية متخصصة، مسؤولة عن حجز وتعديل المواعيد، الإجابة عن أوقات الأطباء، وفرز الحالات الطارئة.',
      )
      setGoals([
        'حجز مواعيد المرضى بدقة مع تسجيل الاسم ورقم الجوال والعيادة المطلوبة',
        'إبلاغ المريض بتعليمات الكشف وساعات عمل الطبيب المعالج',
        'تحويل الحالات الحرجة والطارئة فوراً لرقم الطوارئ أو الطبيب المناوب',
      ])
      setRestricted([
        'لا تقدم تشخيصاً طبياً أو تصرف أدوية للمتصل تحت أي ظرف',
        'لا تعد المريض بمواعيد خارج أوقات العمل دون موافقة الإدارة',
      ])
      setFlows([
        'حجز كشف جديد',
        'إعادة كشف / متابعة',
        'استفسار عن تأمين',
        'إلغاء أو تعديل موعد',
        'تحويل طوارئ',
      ])
    } else if (type === 'realestate') {
      setName('فيصل — العقارات')
      setRole(
        'مستشار مبيعات واستقبال عقاري، مسؤول عن تأهيل المتصلين ومعرفة نوع العقار المطلوب وترتيب مواعيد المعاينات.',
      )
      setGoals([
        'تحديد رغبة العميل (شراء / استئجار / استثمار) والميزانية المحددة',
        'تحديد المدينة والحي ونوع العقار (شقة، فيلا، مكتب)',
        'تنسيق موعد معاينة ميدانية مع المستشار العقاري',
      ])
      setRestricted([
        'لا توقع عقوداً أو تعطي وعوداً بتخفيض الأسعار دون مراجعة المالك',
        'لا تفصح عن بيانات الملاك الشخصية',
      ])
      setFlows(['طلب معاينة عقار', 'استفسار عن الأسعار', 'عرض عقار للبيع/الإيجار', 'تحويل لمستشار'])
    } else if (type === 'auto') {
      setName('سعد — صيانة السيارات')
      setRole(
        'مسؤول استقبال مركز صيانة سيارات، يحدد نوع العطل أو الصيانة الدورية ويحجز موعد دخول السيارة.',
      )
      setGoals([
        'معرفة نوع السيارة والموديل ونوع الصيانة (دورية، ميكانيكا، فحص)',
        'حجز موعد دخول للورشة وإبلاغ العميل بمدة الفحص التقديرية',
      ])
      setRestricted(['لا تعطِ تسعيرة نهائية للأعطال الميكانيكية المعقدة قبل الفحص الميداني'])
      setFlows([
        'حجز صيانة دورية',
        'استفسار عن حالة سيارة',
        'طلب سحب سطحة',
        'استفسار عن قطع الغيار',
      ])
    } else if (type === 'salon') {
      setName('نورة — مركز التجميل')
      setRole('موظفة استقبال مركز تجميل وعناية، مسؤولة عن حجوزات الخدمات والمواعيد والعروض.')
      setGoals([
        'حجز المواعيد للخدمات المطلوبة وتحديد الأخصائية المفضلة',
        'إبلاغ العميلة بالعروض الحالية ومواعيد الفروع',
      ])
      setRestricted(['لا تحجز في أوقات محجوزة مسبقاً'])
      setFlows(['حجز موعد خدمة', 'استفسار عن الباقات والعروض', 'تعديل أو إلغاء موعد'])
    }
  }

  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Edit3 size={14} aria-hidden="true" />
        تعديل المسودة v{draftVersion.versionNumber}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`تعديل إعدادات الموظف الصوتي (مسودة v${draftVersion.versionNumber})`}
        description="عدّل الهوية، الصوت، قواعد وساعات العمل، المسارات، والأدوات المرتبطة. يتم بناء التوجيه الصوتي تلقائيًا من الطبقات التسع."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button variant="primary" disabled={pending} onClick={handleSave}>
              {pending ? 'جارٍ الحفظ وبناء التوجيه…' : 'حفظ التعديلات في المسودة'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-5)' }}>
          {/* Quick Blueprint Presets */}
          <div
            style={{
              padding: 'var(--s-3)',
              background: 'var(--raised)',
              border: '1px dashed var(--signal-line)',
              borderRadius: 'var(--r-panel)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--step--1)',
                fontWeight: 600,
                marginBlockEnd: 'var(--s-2)',
                color: 'var(--signal)',
              }}
            >
              ⚡ تطبيق قالب جاهز بضغطة زر (Auto Blueprint)
            </div>
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => requestBlueprint('clinic')}
              >
                🏥 عيادة طبية
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => requestBlueprint('realestate')}
              >
                🏢 عقارات
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => requestBlueprint('auto')}
              >
                🚗 صيانة سيارات
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => requestBlueprint('salon')}
              >
                ✨ صالون وتجميل
              </button>
            </div>
          </div>

          {/* 1. Identity & Name */}
          <div className="card-sub">
            <h4
              style={{
                marginBlockEnd: 'var(--s-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--s-2)',
              }}
            >
              <Sparkles size={16} style={{ color: 'var(--signal)' }} />
              الهوية والاسم
            </h4>
            <div className="field">
              <label htmlFor="agent-name">اسم الموظف الصوتي</label>
              <input
                id="agent-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="سارة، فيصل، أحمد…"
              />
            </div>
            <div className="field" style={{ marginBlockStart: 'var(--s-3)' }}>
              <label htmlFor="agent-role">الدور الوظيفي والهدف الأساسي</label>
              <textarea
                id="agent-role"
                className="input"
                rows={3}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="أنت موظف استقبال محترف في عيادة كذا، تستقبل المتصلين وتساعدهم في حجز المواعيد والإجابة عن الخدمات…"
              />
            </div>
          </div>

          {/* 2. Voice Profile */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>الصوت واللهجة</h4>
            <div className="field">
              <label htmlFor="voice-profile">الملف الصوتي واللهجة</label>
              <select
                id="voice-profile"
                className="input"
                value={voiceProfileId}
                onChange={(e) => setVoiceProfileId(e.target.value)}
              >
                {voiceProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.dialect} — {p.style})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Goals & Restrictions */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>ما يفعله وما لا يفعله الموظف</h4>
            <div className="field">
              <label htmlFor="new-goal-input">ما يفعله (الأهداف المسموحة)</label>
              <div className="row" style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)' }}>
                <input
                  id="new-goal-input"
                  className="input"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="مثال: حجز موعد جديد في أقرب وقت متاح"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addGoal()
                    }
                  }}
                />
                <Button size="sm" onClick={addGoal} type="button">
                  <Plus size={14} />
                </Button>
              </div>
              <div className="stack" style={{ gap: 'var(--s-1)' }}>
                {goals.map((g) => (
                  <div
                    key={g}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      background: 'var(--surface)',
                      padding: '6px 10px',
                      borderRadius: 'var(--r-control)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--step--1)' }}>{g}</span>
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      style={{
                        color: 'var(--bad)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBlockStart: 'var(--s-4)' }}>
              <label htmlFor="new-restricted-input">ما لا يفعله (القيود الصارمة)</label>
              <div className="row" style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)' }}>
                <input
                  id="new-restricted-input"
                  className="input"
                  value={newRestricted}
                  onChange={(e) => setNewRestricted(e.target.value)}
                  placeholder="مثال: لا تعطي استشارات طبية مهما طلب المتصل"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addRestricted()
                    }
                  }}
                />
                <Button size="sm" onClick={addRestricted} type="button">
                  <Plus size={14} />
                </Button>
              </div>
              <div className="stack" style={{ gap: 'var(--s-1)' }}>
                {restricted.map((r) => (
                  <div
                    key={r}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      background: 'var(--surface)',
                      padding: '6px 10px',
                      borderRadius: 'var(--r-control)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--step--1)' }}>{r}</span>
                    <button
                      type="button"
                      onClick={() => removeRestricted(r)}
                      style={{
                        color: 'var(--bad)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Business Rules & Hours */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>ساعات وقواعد العمل والتحويل</h4>
            <div className="field">
              <label htmlFor="business-hours">ساعات العمل</label>
              <input
                id="business-hours"
                className="input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="من الأحد إلى الخميس: 9:00 ص إلى 10:00 م"
              />
            </div>
            <div className="field" style={{ marginBlockStart: 'var(--s-3)' }}>
              <label htmlFor="transfer-number">رقم التحويل البشري (عند التصعيد)</label>
              <input
                id="transfer-number"
                className="input mono"
                dir="ltr"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="+966500000000"
              />
            </div>
            <div className="field" style={{ marginBlockStart: 'var(--s-3)' }}>
              <label htmlFor="after-hours">السلوك خارج ساعات العمل</label>
              <select
                id="after-hours"
                className="input"
                value={afterHours}
                onChange={(e) => setAfterHours(e.target.value)}
              >
                <option value="callback">تسجيل طلب معاودة اتصال (موصى به)</option>
                <option value="transfer">محاولة التحويل للرقم البشري</option>
                <option value="info_only">الإجابة عن الاستفسارات فقط دون حجز</option>
              </select>
            </div>
          </div>

          {/* 5. Flows */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>المسارات المدعومة</h4>
            {structuredFlows.length > 0 ? (
              <>
                <p className="field__hint" style={{ marginBlockEnd: 'var(--s-3)' }}>
                  هذه المسارات الفعلية التي يستخدمها الموظف الصوتي — مصدرها قالب القطاع عند التهيئة،
                  ولا يمكن تعديلها من هنا بعد.
                </p>
                <div className="stack" style={{ gap: 'var(--s-2)' }}>
                  {structuredFlows.map((f) => (
                    <div key={f.id} className="row" style={{ gap: 'var(--s-2)' }}>
                      <Pill>{f.name}</Pill>
                      <span className="muted" style={{ fontSize: 'var(--step--1)' }}>
                        {f.goal}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="new-flow-input">إضافة مسار جديد</label>
                  <div className="row" style={{ gap: 'var(--s-2)', marginBlockEnd: 'var(--s-2)' }}>
                    <input
                      id="new-flow-input"
                      className="input"
                      value={newFlow}
                      onChange={(e) => setNewFlow(e.target.value)}
                      placeholder="اسم المسار: حجز موعد، إلغاء، استفسار…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addFlow()
                        }
                      }}
                    />
                    <Button size="sm" onClick={addFlow} type="button">
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
                <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                  {flows.map((f) => (
                    <Pill key={f}>
                      {f}
                      <button
                        type="button"
                        onClick={() => removeFlow(f)}
                        style={{
                          color: 'var(--bad)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </Pill>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 6. Tools & Integrations */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>الأدوات والتكاملات</h4>
            <p
              className="muted"
              style={{ fontSize: 'var(--step--1)', marginBlockEnd: 'var(--s-3)' }}
            >
              تحديد ربط هنا يمنح الموظف الصوتي الأداة المقابلة له فقط (حجز، إرسال تأكيد…). بلا ربط
              مفعّل، لا يعد الموظف بأي إجراء لا يقدر ينفذه.
            </p>
            {integrations.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
                لا يوجد أي تكامل مُعدّ لهذا العميل بعد. أضِف واحدًا من صفحة{' '}
                <strong>Integrations</strong> أولًا.
              </p>
            ) : (
              <div className="stack" style={{ gap: 'var(--s-2)' }}>
                {integrations.map((integration) => (
                  <label
                    key={integration.id}
                    className="row"
                    style={{
                      gap: 'var(--s-2)',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--surface)',
                      borderRadius: 'var(--r-control)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={bindings.has(integration.provider)}
                      onChange={() => toggleBinding(integration.provider)}
                    />
                    <Plug size={14} style={{ color: 'var(--signal)' }} aria-hidden="true" />
                    <span style={{ flex: 1, fontSize: 'var(--step--1)' }}>{integration.label}</span>
                    <span className="muted mono" style={{ fontSize: 'var(--step--2)' }} dir="ltr">
                      {integration.provider}
                    </span>
                    <Pill tone={integration.health === 'connected' ? 'good' : 'warn'}>
                      {integration.health === 'connected' ? 'متصل' : 'غير متصل'}
                    </Pill>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 7. Voice-initiated cancellation and rescheduling */}
          <div className="card-sub">
            <h4 style={{ marginBlockEnd: 'var(--s-3)' }}>إلغاء أو تعديل الحجز صوتيًا</h4>
            <p
              className="muted"
              style={{ fontSize: 'var(--step--1)', marginBlockEnd: 'var(--s-3)' }}
            >
              عند التفعيل، يستطيع الموظف الصوتي إلغاء أو تعديل موعد حجز قائم للمتصل نفسه فقط — بدون
              مراجعة بشرية — بعد التحقق من أن رقم الاتصال يطابق رقم صاحب الحجز. القدرة على الحجز
              الجديد والتحقق من التوفر لا تتطلب هذا التفعيل؛ هذا خاص بتعديل حجز قائم فقط.
            </p>
            <label
              className="row"
              style={{
                gap: 'var(--s-2)',
                alignItems: 'center',
                padding: '8px 10px',
                background: 'var(--surface)',
                borderRadius: 'var(--r-control)',
                cursor: hasCalendarBinding ? 'pointer' : 'not-allowed',
                opacity: hasCalendarBinding ? 1 : 0.6,
              }}
            >
              <input
                type="checkbox"
                checked={hasCalendarBinding && voiceCancellationEnabled}
                disabled={!hasCalendarBinding}
                onChange={() => setVoiceCancellationEnabled((prev) => !prev)}
              />
              <span style={{ flex: 1, fontSize: 'var(--step--1)' }}>
                {hasCalendarBinding
                  ? 'السماح للموظف الصوتي بإلغاء أو تعديل حجوزات المتصلين'
                  : 'يتطلب ربط تقويم مفعّلًا أعلاه أولًا'}
              </span>
              {voiceCancellationEnabled && hasCalendarBinding ? (
                <Pill tone="warn">مفعّل</Pill>
              ) : null}
            </label>
          </div>
        </div>
      </Sheet>

      <Confirm
        open={pendingBlueprint !== null}
        onClose={() => setPendingBlueprint(null)}
        onConfirm={() => {
          if (pendingBlueprint) applyBlueprint(pendingBlueprint)
          setPendingBlueprint(null)
        }}
        title="تطبيق القالب الجاهز؟"
        body="سيستبدل هذا الاسم والهوية والأهداف والقيود الحالية بمحتوى القالب الجاهز. لا يمكن التراجع عن هذا إلا بإعادة كتابتها يدويًا."
        confirmLabel="طبّق القالب"
      />
    </>
  )
}
