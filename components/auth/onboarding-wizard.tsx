'use client'

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { provisionWorkspace } from '@/server/actions/onboarding'

export type WizardPack = {
  packKey: string
  name: string
  version: string
  flows: string[]
  integrations: string[]
}

const STEPS = [
  { n: '01', title: 'النشاط' },
  { n: '02', title: 'القطاع' },
  { n: '03', title: 'الخدمات والفروع' },
  { n: '04', title: 'التشغيل' },
  { n: '05', title: 'المراجعة' },
] as const

const OPERATING_ROADMAP = [
  { title: 'ملف العميل', body: 'المنشأة، المسؤول، المدينة والمنطقة الزمنية.' },
  { title: 'القالب والمسارات', body: 'اختيار القطاع واسم الموظف الصوتي.' },
  { title: 'المعرفة', body: 'الخدمات أو المنتجات والفروع كمصدر موثوق.' },
  { title: 'الرقم والتصعيد', body: 'ساعات العمل، رقم التحويل، ورقم الاستقبال.' },
  { title: 'اختبار الصوت', body: 'تشغيل سيناريوهات حقيقية قبل الإطلاق.' },
  { title: 'النشر والتشغيل', body: 'ربط الرقم بالنسخة المنشورة ومراقبة أول مكالمات.' },
] as const

const PACK_BLURB: Record<string, string> = {
  medical: 'حجز وتغيير المواعيد، وتقليل الغياب.',
  realestate: 'تأهيل المتصل، وترتيب المعاينات.',
  auto: 'حجوزات الصيانة، ومتابعة حالة السيارة.',
  reception: 'فرز الطلبات، والتوجيه للقسم الصحيح.',
  hospitality: 'حجوزات واستفسارات وتجارب ضيافة.',
  services: 'طلبات متابعة وخدمة عملاء عامة.',
  education: 'استفسارات البرامج والمواعيد والتسجيل.',
}

const TIMEZONES = [
  { value: 'Asia/Riyadh', label: 'الرياض (GMT+3)' },
  { value: 'Asia/Dubai', label: 'دبي (GMT+4)' },
  { value: 'Africa/Cairo', label: 'القاهرة (GMT+2)' },
  { value: 'Asia/Kuwait', label: 'الكويت (GMT+3)' },
  { value: 'Asia/Qatar', label: 'الدوحة (GMT+3)' },
]

/**
 * Rows carry their own id. Keying editable rows by array index makes React
 * reuse the wrong input when a row in the middle is removed, which steals focus
 * and shows the previous row's value.
 */
type Row = { id: string; title: string; price: string }

let rowSeq = 0
function newRow(): Row {
  rowSeq += 1
  return { id: `r${rowSeq}`, title: '', price: '' }
}

function getRoadmapState(index: number, step: number) {
  const active = Math.min(step, OPERATING_ROADMAP.length - 2)
  if (index < active) return 'done'
  if (index === active) return 'current'
  return 'todo'
}

export function OnboardingWizard({ packs }: { packs: WizardPack[] }) {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    name: string
    agent: string
    inviteUrl: string
    workspaceSlug: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [city, setCity] = useState('')
  const [timezone, setTimezone] = useState('Asia/Riyadh')
  const [pack, setPack] = useState(packs[0]?.packKey ?? 'medical')
  const [agentName, setAgentName] = useState('')
  const [services, setServices] = useState<Row[]>([newRow()])
  const [branches, setBranches] = useState<Row[]>([newRow()])
  const [hoursWeekday, setHoursWeekday] = useState('09:00–21:00')
  const [hoursWeekend, setHoursWeekend] = useState('10:00–18:00')
  const [transferTo, setTransferTo] = useState('')
  const [did, setDid] = useState('')

  const selectedPack = packs.find((p) => p.packKey === pack)

  function canAdvance() {
    if (step === 0)
      return (
        name.trim().length >= 2 &&
        city.trim().length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())
      )
    if (step === 1) return Boolean(pack) && agentName.trim().length >= 2
    if (step === 2) {
      // Every non-blank row must be individually valid, not just one of them —
      // otherwise a stray 1-character row survives this gate and only fails at
      // the very last step, against the server's schema.
      const svc = services.filter((s) => s.title.trim())
      const br = branches.filter((b) => b.title.trim())
      return (
        svc.length > 0 &&
        svc.every((s) => s.title.trim().length >= 2) &&
        br.length > 0 &&
        br.every((b) => b.title.trim().length >= 2)
      )
    }
    if (step === 3) return /^\+?[0-9\s-]{8,20}$/.test(transferTo.trim())
    return true
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await provisionWorkspace({
        name,
        ownerEmail,
        city,
        timezone,
        pack,
        agentName,
        services: services
          .filter((s) => s.title.trim())
          .map((s) => ({ title: s.title.trim(), price: s.price.trim() })),
        branches: branches.filter((b) => b.title.trim()).map((b) => b.title.trim()),
        hoursWeekday,
        hoursWeekend,
        transferTo,
        did: did.trim(),
      })

      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone({
        name: result.workspaceName,
        agent: result.agentName,
        inviteUrl: result.inviteUrl,
        workspaceSlug: result.workspaceSlug,
      })
    })
  }

  if (done) {
    return (
      <div className="wizard">
        <div className="wizard__bar">
          <Logo size="sm" />
        </div>
        <div className="wizard__done">
          <Pill tone="good" dot>
            تمت التهيئة
          </Pill>
          <h1>{done.name} جاهزة للبناء.</h1>
          <p>
            أنشأنا مساحة العمل، وسجّلنا خدماتك وفروعك كمعرفة منظّمة، وبنينا النسخة الأولى من الموظف
            الصوتي «{done.agent}» كمسودة. النشر متوقف حتى يجتاز اختبار الصوت ويُوثَّق مسار الهاتف —
            وهذه خطوة يتولاها فريق التشغيل معك.
          </p>
          <div className="wizard__invite">
            <span>دعوة مسؤول العميل</span>
            <code dir="ltr">{done.inviteUrl}</code>
            <Button
              size="sm"
              leading={<Clipboard size={15} />}
              onClick={async () => {
                await navigator.clipboard.writeText(done.inviteUrl)
                toast.success('نُسخ رابط الدعوة.')
              }}
            >
              نسخ الرابط
            </Button>
          </div>
          <section
            className="wizard__roadmap wizard__roadmap--done"
            aria-label="مسار التشغيل التالي"
          >
            <div className="wizard__roadmap-head">
              <strong>المتبقي قبل المكالمة الأولى</strong>
              <span>تشغيل منضبط بدل نشر عشوائي</span>
            </div>
            <ol>
              {OPERATING_ROADMAP.map((item, index) => {
                const state = getRoadmapState(index, 4)
                return (
                  <li key={item.title} data-state={state}>
                    <span className="wizard__roadmap-mark" aria-hidden="true">
                      {state === 'done' ? <Check size={12} /> : index + 1}
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>
          <div className="row">
            <Link href={`/console/clients/${done.workspaceSlug}`} className="btn btn--primary">
              افتح مساحة العمل
            </Link>
            <Link href="/console" className="btn">
              لوحة التشغيل
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <div className="wizard__bar">
        <Link href="/console" aria-label="مُجاوِب">
          <Logo size="sm" />
        </Link>
        <div className="wizard__steps">
          {STEPS.map((s, i) => (
            <span
              key={s.n}
              className="wizard__step"
              data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
            >
              {i < step ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <span className="wizard__step-n">{s.n}</span>
              )}
              {s.title}
            </span>
          ))}
        </div>
      </div>

      <div className="wizard__body">
        <div className="wizard__main">
          {error ? (
            <p className="auth__error" role="alert">
              <AlertCircle
                size={16}
                aria-hidden="true"
                style={{ flex: 'none', marginBlockStart: 2 }}
              />
              {error}
            </p>
          ) : null}

          {step === 0 ? (
            <>
              <div>
                <h1 className="wizard__title">لنبدأ بالشركة.</h1>
                <p className="wizard__lead">
                  هذه البيانات تحدد كيف يعرّف الموظف الصوتي نفسه على المتصل، وأي منطقة زمنية تُحسب بها
                  المواعيد.
                </p>
              </div>
              <div className="wizard__fields">
                <div className="field">
                  <label htmlFor="w-name">اسم المنشأة كما يُنطق في المكالمة</label>
                  <input
                    id="w-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مركز ريجوفيرا / شركة المثال"
                  />
                </div>
                <div className="field">
                  <label htmlFor="w-owner-email">بريد مسؤول العميل</label>
                  <input
                    id="w-owner-email"
                    className="input mono"
                    type="email"
                    autoComplete="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@company.com"
                  />
                  <span className="field__hint">سيستلم صلاحية إدارة بوابة هذه الشركة فقط.</span>
                </div>
                <div className="wizard__grid-2">
                  <div className="field">
                    <label htmlFor="w-city">المدينة</label>
                    <input
                      id="w-city"
                      className="input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="الرياض"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="w-tz">المنطقة الزمنية</label>
                    <select
                      id="w-tz"
                      className="input"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      {TIMEZONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div>
                <h1 className="wizard__title">أي قطاع يصف عملك؟</h1>
                <p className="wizard__lead">
                  القالب يحدد المسارات الجاهزة والتكاملات الافتراضية وحزمة اختبار الجودة. يمكن تعديل
                  كل ذلك لاحقًا.
                </p>
              </div>
              <div className="choices">
                {packs.map((p) => (
                  <button
                    key={p.packKey}
                    type="button"
                    className="choice"
                    aria-pressed={p.packKey === pack}
                    onClick={() => setPack(p.packKey)}
                  >
                    <strong>{p.name}</strong>
                    <span>{PACK_BLURB[p.packKey] ?? ''}</span>
                    <span className="choice__flows">
                      {p.flows.slice(0, 3).map((f) => (
                        <Pill key={f}>{f}</Pill>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="w-agent">اسم الموظف الصوتي</label>
                <input
                  id="w-agent"
                  className="input"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="سارة"
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div>
                <h1 className="wizard__title">ما الذي يجب أن يعرفه عن عملك؟</h1>
                <p className="wizard__lead">
                  الخدمات أو المنتجات والفروع تُحفظ كمعرفة منظّمة — الموظف الصوتي يقرأ منها مباشرة،
                  ولا يخمّن سعرًا أو موقعًا غير مذكور هنا.
                </p>
              </div>

              <div className="wizard__fields">
                <div className="field">
                  <span className="field__group-label">الخدمات أو المنتجات وأسعارها</span>
                  {services.map((s, i) => (
                    <div key={s.id} className="repeat-row">
                      <input
                        className="input"
                        value={s.title}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                          )
                        }
                        placeholder="استشارة أولية / باقة صيانة / خدمة زيارة"
                        aria-label={`اسم الخدمة ${i + 1}`}
                      />
                      <input
                        className="input"
                        value={s.price}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)),
                          )
                        }
                        placeholder="250 ر.س"
                        aria-label={`سعر الخدمة ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="repeat-remove"
                        onClick={() => setServices((prev) => prev.filter((_, j) => j !== i))}
                        disabled={services.length === 1}
                        aria-label="حذف الخدمة"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() => setServices((prev) => [...prev, newRow()])}
                    leading={<Plus size={14} />}
                    className="wizard__add"
                  >
                    أضف خدمة
                  </Button>
                </div>

                <div className="field">
                  <span className="field__group-label">الفروع</span>
                  {branches.map((b, i) => (
                    <div key={b.id} className="repeat-row">
                      <input
                        className="input"
                        value={b.title}
                        onChange={(e) =>
                          setBranches((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                          )
                        }
                        placeholder="فرع العليا"
                        aria-label={`الفرع ${i + 1}`}
                        style={{ gridColumn: 'span 2' }}
                      />
                      <button
                        type="button"
                        className="repeat-remove"
                        onClick={() => setBranches((prev) => prev.filter((_, j) => j !== i))}
                        disabled={branches.length === 1}
                        aria-label="حذف الفرع"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() => setBranches((prev) => [...prev, newRow()])}
                    leading={<Plus size={14} />}
                  >
                    أضف فرعًا
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <h1 className="wizard__title">متى يرد، وإلى أين يحوّل؟</h1>
                <p className="wizard__lead">
                  خارج ساعات العمل يسجّل الموظف الصوتي طلب معاودة اتصال بدل أن يترك المتصل بلا رد.
                </p>
              </div>
              <div className="wizard__fields">
                <div className="wizard__grid-2">
                  <div className="field">
                    <label htmlFor="w-hw">الأحد – الخميس</label>
                    <input
                      id="w-hw"
                      className="input mono"
                      value={hoursWeekday}
                      onChange={(e) => setHoursWeekday(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="w-he">السبت</label>
                    <input
                      id="w-he"
                      className="input mono"
                      value={hoursWeekend}
                      onChange={(e) => setHoursWeekend(e.target.value)}
                      placeholder="مغلق"
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="w-transfer">رقم التحويل عند التصعيد</label>
                  <input
                    id="w-transfer"
                    className="input mono"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder="+966551200430"
                  />
                </div>
                <div className="field">
                  <label htmlFor="w-did">رقم الاستقبال (اختياري)</label>
                  <input
                    id="w-did"
                    className="input mono"
                    value={did}
                    onChange={(e) => setDid(e.target.value)}
                    placeholder="+966112400118"
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    إن لم يتوفر الآن، يتولى فريق التشغيل تجهيزه وربطه لاحقًا.
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div>
                <h1 className="wizard__title">راجع قبل التهيئة.</h1>
                <p className="wizard__lead">
                  عند التأكيد ننشئ مساحة العمل والمعرفة المنظّمة ومسودة النسخة الأولى من الموظف
                  الصوتي. النشر يبقى موقوفًا حتى تجتاز اختبارات الصوت ويُوثَّق مسار الهاتف.
                </p>
              </div>
              <div className="wizard__fields">
                <div className="panel">
                  <div className="panel__body">
                    <p style={{ fontSize: 'var(--step--1)', lineHeight: 1.8 }}>
                      سيُنشأ: مساحة عمل باسم <strong>{name || '—'}</strong> على قالب{' '}
                      <strong>{selectedPack?.name ?? '—'}</strong>، مع{' '}
                      <strong>{services.filter((s) => s.title.trim()).length}</strong> خدمة و
                      <strong> {branches.filter((b) => b.title.trim()).length}</strong> فرعًا كمعرفة
                      منظّمة، وموظف صوتي باسم <strong>{agentName || '—'}</strong> بنسخة مسودة v1 تحمل{' '}
                      <strong>{selectedPack?.flows.length ?? 0}</strong> مسارًا و
                      <strong> {selectedPack?.integrations.length ?? 0}</strong> تكاملًا بانتظار
                      الربط.
                    </p>
                    <p className="muted" style={{ marginBlockStart: 'var(--s-3)' }}>
                      ستُنشأ دعوة إدارة إلى <span className="mono">{ownerEmail || '—'}</span> وتظهر
                      لك مرة واحدة بعد التهيئة.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="wizard__actions">
            {step > 0 ? (
              <Button
                onClick={() => setStep((s) => s - 1)}
                disabled={pending}
                leading={<ArrowRight size={16} aria-hidden="true" />}
              >
                السابق
              </Button>
            ) : (
              <Link href="/console" className="btn">
                إلغاء
              </Link>
            )}

            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                trailing={<ArrowLeft size={16} className="arrow" aria-hidden="true" />}
              >
                التالي
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={submit}
                disabled={pending}
                trailing={
                  pending ? (
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )
                }
              >
                {pending ? 'جارٍ التهيئة…' : 'أنشئ مساحة العمل'}
              </Button>
            )}
          </div>
        </div>

        {/* The rail fills in as the wizard proceeds — no step is a black box. */}
        <aside className="wizard__summary">
          <h3>ما سيُنشأ</h3>
          <dl>
            <div className="wizard__summary-row">
              <dt>الشركة</dt>
              <dd>{name || '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>المدينة</dt>
              <dd>{city || '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>مسؤول العميل</dt>
              <dd className="mono">{ownerEmail || '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>القالب</dt>
              <dd>{selectedPack?.name ?? '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>الموظف الصوتي</dt>
              <dd>{agentName || '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>الخدمات</dt>
              <dd className="mono">{services.filter((s) => s.title.trim()).length}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>الفروع</dt>
              <dd className="mono">{branches.filter((b) => b.title.trim()).length}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>التحويل</dt>
              <dd className="mono">{transferTo || '—'}</dd>
            </div>
            <div className="wizard__summary-row">
              <dt>حالة النشر</dt>
              <dd>
                <Pill tone="warn">موقوف حتى الاختبار</Pill>
              </dd>
            </div>
          </dl>
          <section className="wizard__roadmap" aria-label="مسار الوصول للتشغيل">
            <div className="wizard__roadmap-head">
              <strong>من التسجيل إلى التشغيل</strong>
              <span>الخطوة التالية تظهر هنا لحظة بلحظة</span>
            </div>
            <ol>
              {OPERATING_ROADMAP.map((item, index) => {
                const state = getRoadmapState(index, step)
                return (
                  <li key={item.title} data-state={state}>
                    <span className="wizard__roadmap-mark" aria-hidden="true">
                      {state === 'done' ? <Check size={12} /> : index + 1}
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}
