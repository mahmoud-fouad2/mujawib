'use client'

import { Edit3, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { updateAgentDraft } from '@/server/actions/console'

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
  }
  voiceProfiles: VoiceProfileOption[]
}

export function AgentEditorSheet({
  agentId,
  agentName: initialName,
  draftVersion,
  voiceProfiles,
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

  const [newGoal, setNewGoal] = useState('')
  const [newRestricted, setNewRestricted] = useState('')
  const [newFlow, setNewFlow] = useState('')

  const { run, pending } = useAction()

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
        }),
      () => setOpen(false),
    )
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
        description="عدّل الهوية، الصوت، قواعد وساعات العمل، والمسارات. يتم بناء التوجيه الصوتي تلقائيًا من الطبقات التسع."
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
              background: 'var(--surface-subtle)',
              border: '1px dashed var(--signal-line)',
              borderRadius: 'var(--r-md)',
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
                onClick={() => applyBlueprint('clinic')}
              >
                🏥 عيادة طبية
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => applyBlueprint('realestate')}
              >
                🏢 عقارات
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => applyBlueprint('auto')}
              >
                🚗 صيانة سيارات
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => applyBlueprint('salon')}
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
                      background: 'var(--surface-elevated)',
                      padding: '6px 10px',
                      borderRadius: 'var(--r-sm)',
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
                      background: 'var(--surface-elevated)',
                      padding: '6px 10px',
                      borderRadius: 'var(--r-sm)',
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
                <span
                  key={f}
                  className="pill"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
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
                </span>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
