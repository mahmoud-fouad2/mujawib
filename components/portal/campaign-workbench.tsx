'use client'

import { Ban, Megaphone, Plus, RotateCw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { Pill } from '@/components/ui/primitives'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  CAMPAIGN_PURPOSE_LABEL,
  type CampaignPurpose,
  CONSENT_BASIS_LABEL,
  CONTACT_IMPORT_ISSUE_LABEL,
  type ConsentBasis,
  DEFAULT_CALLING_WINDOW,
  EARLIEST_CALL_MINUTE,
  LATEST_CALL_MINUTE,
  MAX_CALLS_PER_DAY,
  MAX_CONCURRENT_CALLS,
  MAX_CONTACTS_PER_CAMPAIGN,
  minuteToTime,
  timeToMinute,
  WEEKDAY_LABEL,
} from '@/lib/campaigns'
import {
  clearCampaignContacts,
  importCampaignContacts,
  retryCampaignContact,
  saveCampaign,
  setCampaignRunState,
  submitCampaignForReview,
  suppressNumber,
  unsuppressNumber,
  withdrawCampaign,
} from '@/server/actions/campaigns'

/**
 * The client's half of outbound campaigns: build, upload, submit, stop.
 *
 * There is no "start" control anywhere in this file, and that is not an
 * oversight. A client assembles a campaign and hands it over; the decision to
 * actually dial a list of real people belongs to the platform, and the server
 * action enforces it whether or not a button exists here.
 *
 * Stopping is the exception — it is available immediately, to the client, with
 * no review. Halting something that is calling your own customers must never
 * wait on somebody else being awake.
 */

export type TargetOption = { id: string; label: string }

export type CampaignFormRow = {
  id: string
  name: string
  purpose: CampaignPurpose | null
  consentBasis: ConsentBasis | null
  consentNote: string | null
  agentVersionId: string | null
  fromNumberId: string | null
  script: string | null
  forbiddenClaims: string | null
  windowStartMinute: number
  windowEndMinute: number
  windowDays: number[]
  utcOffsetMinutes: number
  initialConcurrency: number
  maxConcurrency: number
  rampMinutes: number
  dailyCap: number
}

type FormState = {
  name: string
  purpose: CampaignPurpose
  consentBasis: ConsentBasis
  consentNote: string
  agentVersionId: string
  fromNumberId: string
  script: string
  forbiddenClaims: string
  startTime: string
  endTime: string
  days: number[]
  utcOffsetMinutes: number
  initialConcurrency: number
  maxConcurrency: number
  rampMinutes: number
  dailyCap: number
}

function blankForm(row?: CampaignFormRow): FormState {
  return {
    name: row?.name ?? '',
    purpose: row?.purpose ?? 'followup',
    consentBasis: row?.consentBasis ?? 'existing_customer',
    consentNote: row?.consentNote ?? '',
    agentVersionId: row?.agentVersionId ?? '',
    fromNumberId: row?.fromNumberId ?? '',
    script: row?.script ?? '',
    forbiddenClaims: row?.forbiddenClaims ?? '',
    startTime: minuteToTime(row?.windowStartMinute ?? DEFAULT_CALLING_WINDOW.startMinute),
    endTime: minuteToTime(row?.windowEndMinute ?? DEFAULT_CALLING_WINDOW.endMinute),
    days: row?.windowDays ?? [...DEFAULT_CALLING_WINDOW.activeDays],
    utcOffsetMinutes: row?.utcOffsetMinutes ?? DEFAULT_CALLING_WINDOW.utcOffsetMinutes,
    initialConcurrency: row?.initialConcurrency ?? 1,
    maxConcurrency: row?.maxConcurrency ?? 3,
    rampMinutes: row?.rampMinutes ?? 10,
    dailyCap: row?.dailyCap ?? 100,
  }
}

function CampaignSheet({
  workspaceId,
  versions,
  numbers,
  row,
  open,
  onClose,
}: {
  workspaceId: string
  versions: TargetOption[]
  numbers: TargetOption[]
  row?: CampaignFormRow
  open: boolean
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(() => blankForm(row))
  const { run, pending } = useAction()

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleDay = (day: number) =>
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))

  const incomplete =
    form.name.trim().length < 3 ||
    !form.agentVersionId ||
    !form.fromNumberId ||
    form.script.trim().length < 40

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={row ? 'تعديل الحملة' : 'حملة اتصال صادر'}
      description="تُحفظ كمسودة. لا تبدأ أي مكالمة قبل مراجعة الفريق واعتمادها."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || incomplete}
            onClick={() =>
              run(
                () =>
                  saveCampaign({
                    ...(row ? { id: row.id } : {}),
                    workspaceId,
                    name: form.name,
                    purpose: form.purpose,
                    consentBasis: form.consentBasis,
                    consentNote: form.consentNote.trim() || undefined,
                    agentVersionId: form.agentVersionId,
                    fromNumberId: form.fromNumberId,
                    script: form.script,
                    forbiddenClaims: form.forbiddenClaims.trim() || undefined,
                    windowStartMinute: timeToMinute(
                      form.startTime,
                      DEFAULT_CALLING_WINDOW.startMinute,
                    ),
                    windowEndMinute: timeToMinute(form.endTime, DEFAULT_CALLING_WINDOW.endMinute),
                    windowDays: form.days,
                    utcOffsetMinutes: form.utcOffsetMinutes,
                    initialConcurrency: form.initialConcurrency,
                    maxConcurrency: form.maxConcurrency,
                    rampMinutes: form.rampMinutes,
                    dailyCap: form.dailyCap,
                  }),
                onClose,
              )
            }
          >
            {pending ? 'جارٍ الحفظ…' : 'حفظ المسودة'}
          </Button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="camp-name">اسم الحملة</label>
        <input
          id="camp-name"
          className="input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="متابعة عملاء سبتمبر"
        />
      </div>

      <div className="field">
        <label htmlFor="camp-purpose">الغرض</label>
        <select
          id="camp-purpose"
          className="input"
          value={form.purpose}
          onChange={(e) => set('purpose', e.target.value as CampaignPurpose)}
        >
          {Object.entries(CAMPAIGN_PURPOSE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="camp-consent">الأساس القانوني للاتصال</label>
        <select
          id="camp-consent"
          className="input"
          value={form.consentBasis}
          onChange={(e) => set('consentBasis', e.target.value as ConsentBasis)}
        >
          {Object.entries(CONSENT_BASIS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="hint">
          لا يوجد خيار «قائمة مشتراة» أو «أرقام عامة». الاتصال بمن لم يطلبه ولم يتعامل معك ليس حملة
          — هو إزعاج، وقد يعرّضك للمساءلة.
        </span>
      </div>

      <div className="field">
        <label htmlFor="camp-consent-note">من أين جاءت القائمة؟ (يُحفظ للمراجعة)</label>
        <textarea
          id="camp-consent-note"
          className="input"
          rows={2}
          value={form.consentNote}
          onChange={(e) => set('consentNote', e.target.value)}
          placeholder="عملاء حجزوا خلال آخر ٩٠ يومًا من نظام الحجوزات."
        />
      </div>

      <div className="field">
        <label htmlFor="camp-agent">الموظف الصوتي</label>
        <select
          id="camp-agent"
          className="input"
          value={form.agentVersionId}
          onChange={(e) => set('agentVersionId', e.target.value)}
        >
          <option value="">— اختر —</option>
          {versions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {versions.length === 0 ? (
          <span className="hint">لا يوجد موظف منشور بعد. انشر نسخة أولًا.</span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="camp-from">الرقم الظاهر للمستقبِل</label>
        <select
          id="camp-from"
          className="input"
          value={form.fromNumberId}
          onChange={(e) => set('fromNumberId', e.target.value)}
        >
          <option value="">— اختر —</option>
          {numbers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="camp-script">تعليمات المكالمة</label>
        <textarea
          id="camp-script"
          className="input"
          rows={5}
          value={form.script}
          onChange={(e) => set('script', e.target.value)}
          placeholder="عرّف بنفسك باسم النشاط، واسأل العميل عن تجربته مع آخر زيارة، وسجّل ملاحظته."
        />
        <span className="hint">{form.script.trim().length} / ٤٠ حرفًا على الأقل</span>
      </div>

      <div className="field">
        <label htmlFor="camp-forbidden">ما يجب ألا يقوله</label>
        <textarea
          id="camp-forbidden"
          className="input"
          rows={3}
          value={form.forbiddenClaims}
          onChange={(e) => set('forbiddenClaims', e.target.value)}
          placeholder="لا تذكر أسعارًا، لا تعد بخصم، لا تدّعِ نتائج طبية."
        />
        <span className="hint">
          يُضاف إلى تعليمات الموظف كقيود صريحة. اتركه فارغًا وستظهر ملاحظة عند المراجعة.
        </span>
      </div>

      <fieldset className="field">
        <legend>أيام الاتصال</legend>
        <div className="day-toggles">
          {WEEKDAY_LABEL.map((label, day) => (
            <button
              key={label}
              type="button"
              className="day-toggle"
              aria-pressed={form.days.includes(day)}
              onClick={() => toggleDay(day)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="camp-start">من الساعة</label>
        <input
          id="camp-start"
          type="time"
          className="input"
          value={form.startTime}
          onChange={(e) => set('startTime', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="camp-end">إلى الساعة</label>
        <input
          id="camp-end"
          type="time"
          className="input"
          value={form.endTime}
          onChange={(e) => set('endTime', e.target.value)}
        />
        <span className="hint">
          مهما كتبت، لا يتصل النظام قبل {minuteToTime(EARLIEST_CALL_MINUTE)} ولا بعد{' '}
          {minuteToTime(LATEST_CALL_MINUTE)} بتوقيت النشاط.
        </span>
      </div>

      <div className="field">
        <label htmlFor="camp-daily">الحد اليومي للمكالمات</label>
        <input
          id="camp-daily"
          type="number"
          min={1}
          max={MAX_CALLS_PER_DAY}
          className="input"
          value={form.dailyCap}
          onChange={(e) => set('dailyCap', Number(e.target.value) || 1)}
        />
      </div>

      <div className="field">
        <label htmlFor="camp-max">أقصى مكالمات متزامنة</label>
        <input
          id="camp-max"
          type="number"
          min={1}
          max={MAX_CONCURRENT_CALLS}
          className="input"
          value={form.maxConcurrency}
          onChange={(e) => set('maxConcurrency', Number(e.target.value) || 1)}
        />
        <span className="hint">
          تبدأ الحملة بمكالمة واحدة وترتفع تدريجيًا كل {form.rampMinutes} دقيقة — حتى تظهر أي مشكلة
          في النص بعد مكالمة واحدة لا بعد مئتين.
        </span>
      </div>
    </Sheet>
  )
}

export function NewCampaign({
  workspaceId,
  versions,
  numbers,
}: {
  workspaceId: string
  versions: TargetOption[]
  numbers: TargetOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        حملة جديدة
      </Button>
      {open ? (
        <CampaignSheet
          workspaceId={workspaceId}
          versions={versions}
          numbers={numbers}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function EditCampaign({
  workspaceId,
  versions,
  numbers,
  row,
}: {
  workspaceId: string
  versions: TargetOption[]
  numbers: TargetOption[]
  row: CampaignFormRow
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        تعديل
      </Button>
      {open ? (
        <CampaignSheet
          workspaceId={workspaceId}
          versions={versions}
          numbers={numbers}
          row={row}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

/* ─── contact upload ─────────────────────────────────────────────────────── */

type ImportReport = {
  inserted: number
  duplicatesInFile: number
  alreadyPresent: number
  suppressed: number
  rejected: { line: number; raw: string; reason: string }[]
}

/**
 * Reads the file in the browser and sends text.
 *
 * Nothing is written to the server's disk, which matters on a container that
 * is replaced on every deploy and has 512MB to work with — and it means the
 * whole upload path is one Server Action with no multipart handling, no
 * temporary file, and nothing to clean up if the request dies halfway.
 */
export function UploadContacts({
  campaignId,
  workspaceId,
  disabled,
}: {
  campaignId: string
  workspaceId: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)
  const { run } = useAction()

  async function onPick(file: File) {
    setBusy(true)
    try {
      const csv = await file.text()
      const result = await importCampaignContacts({ campaignId, workspaceId, csv })
      if (result.ok && result.data) setReport(result.data)
      run(async () => result)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPick(file)
        }}
      />
      <Button
        size="sm"
        variant="primary"
        leading={<Upload size={15} />}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'جارٍ القراءة…' : 'رفع قائمة CSV'}
      </Button>

      {report ? (
        <Sheet
          open
          onClose={() => setReport(null)}
          title="نتيجة الرفع"
          description="كل صف مرفوض معروض بسببه ورقم سطره — لا شيء يُحذف بصمت."
          footer={
            <Button variant="primary" onClick={() => setReport(null)}>
              تم
            </Button>
          }
        >
          <ul className="stat-list">
            <li>
              <span>أُضيفت</span>
              <strong>{report.inserted}</strong>
            </li>
            <li>
              <span>مكرر داخل الملف</span>
              <strong>{report.duplicatesInFile}</strong>
            </li>
            <li>
              <span>موجود مسبقًا في الحملة</span>
              <strong>{report.alreadyPresent}</strong>
            </li>
            <li>
              <span>في قائمة الحظر</span>
              <strong>{report.suppressed}</strong>
            </li>
          </ul>
          {report.rejected.length > 0 ? (
            <div className="table-scroll">
              <table className="table table--rows table--cards">
                <thead>
                  <tr>
                    <th>السطر</th>
                    <th>السبب</th>
                    <th>المحتوى</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rejected.map((issue) => (
                    <tr key={`${issue.line}-${issue.raw}`}>
                      <td data-label="السطر">{issue.line}</td>
                      <td data-label="السبب">
                        {CONTACT_IMPORT_ISSUE_LABEL[
                          issue.reason as keyof typeof CONTACT_IMPORT_ISSUE_LABEL
                        ] ?? issue.reason}
                      </td>
                      <td data-label="المحتوى">
                        <code>{issue.raw}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="hint">
            الحد الأقصى {MAX_CONTACTS_PER_CAMPAIGN} جهة للحملة الواحدة. الأعمدة المقبولة: phone /
            الجوال، name / الاسم، وأي أعمدة أخرى تُحفظ للاستخدام في نص المكالمة.
          </p>
        </Sheet>
      ) : null}
    </>
  )
}

export function ClearContacts({
  campaignId,
  workspaceId,
  disabled,
}: {
  campaignId: string
  workspaceId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()
  return (
    <>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        مسح القائمة
      </Button>
      <Confirm
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          run(
            () => clearCampaignContacts(campaignId, workspaceId),
            () => setOpen(false),
          )
        }
        title="مسح كل جهات الحملة؟"
        body="سيُحذف كل من رُفع في هذه الحملة. لا يمكن التراجع."
        confirmLabel="مسح"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

/* ─── lifecycle ──────────────────────────────────────────────────────────── */

export function SubmitForReview({
  campaignId,
  workspaceId,
  ready,
}: {
  campaignId: string
  workspaceId: string
  ready: boolean
}) {
  const { run, pending } = useAction()
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={pending || !ready}
      onClick={() => run(() => submitCampaignForReview(campaignId, workspaceId))}
    >
      {pending ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}
    </Button>
  )
}

export function WithdrawCampaign({
  campaignId,
  workspaceId,
}: {
  campaignId: string
  workspaceId: string
}) {
  const { run, pending } = useAction()
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => run(() => withdrawCampaign(campaignId, workspaceId))}
    >
      سحب للمسودة
    </Button>
  )
}

export function RunStateControls({
  campaignId,
  workspaceId,
  status,
}: {
  campaignId: string
  workspaceId: string
  status: string
}) {
  const { run, pending } = useAction()
  const [stopping, setStopping] = useState(false)
  const canHalt = status === 'running' || status === 'paused' || status === 'approved'
  if (!canHalt) return null

  return (
    <>
      {status === 'running' ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => setCampaignRunState(campaignId, workspaceId, 'paused'))}
        >
          إيقاف مؤقت
        </Button>
      ) : null}
      <Button size="sm" variant="danger" disabled={pending} onClick={() => setStopping(true)}>
        إيقاف نهائي
      </Button>
      <Confirm
        open={stopping}
        onClose={() => setStopping(false)}
        onConfirm={() =>
          run(
            () => setCampaignRunState(campaignId, workspaceId, 'stopped'),
            () => setStopping(false),
          )
        }
        title="إيقاف الحملة نهائيًا؟"
        body="لن تُجرى أي مكالمة أخرى. المكالمات الجارية الآن تكمل، والباقي يُلغى."
        confirmLabel="إيقاف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

export function RetryContact({
  contactId,
  workspaceId,
}: {
  contactId: string
  workspaceId: string
}) {
  const { run, pending } = useAction()
  return (
    <Button
      size="sm"
      leading={<RotateCw size={14} />}
      disabled={pending}
      onClick={() => run(() => retryCampaignContact(contactId, workspaceId))}
    >
      إعادة المحاولة
    </Button>
  )
}

/* ─── suppression list ───────────────────────────────────────────────────── */

export function AddSuppression({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const { run, pending } = useAction()

  return (
    <>
      <Button size="sm" leading={<Ban size={15} />} onClick={() => setOpen(true)}>
        حظر رقم
      </Button>
      {open ? (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title="إضافة رقم لقائمة الحظر"
          description="يُلغى فورًا من كل حملة مجدولة، ولا يُقبل في أي رفع لاحق."
          footer={
            <>
              <Button onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                disabled={pending || phone.trim().length < 5}
                onClick={() =>
                  run(
                    () =>
                      suppressNumber({
                        workspaceId,
                        phone,
                        reason: reason.trim() || undefined,
                      }),
                    () => {
                      setOpen(false)
                      setPhone('')
                      setReason('')
                    },
                  )
                }
              >
                {pending ? 'جارٍ الحفظ…' : 'حظر'}
              </Button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="supp-phone">الرقم</label>
            <input
              id="supp-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966501234567"
              dir="ltr"
            />
          </div>
          <div className="field">
            <label htmlFor="supp-reason">السبب (اختياري)</label>
            <input
              id="supp-reason"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="طلب عدم الاتصال به"
            />
          </div>
          <p className="hint">
            الحظر بلا تاريخ انتهاء. طلب «لا تتصلوا بي» الذي ينتهي من تلقاء نفسه ليس طلبًا.
          </p>
        </Sheet>
      ) : null}
    </>
  )
}

export function SuppressionRowActions({
  entryId,
  workspaceId,
}: {
  entryId: string
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()
  return (
    <>
      <RowActions label="خيارات الرقم">
        <RowAction onClick={() => setOpen(true)} tone="danger">
          إزالة من الحظر
        </RowAction>
      </RowActions>
      <Confirm
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          run(
            () => unsuppressNumber(entryId, workspaceId),
            () => setOpen(false),
          )
        }
        title="إزالة الرقم من قائمة الحظر؟"
        body="سيصبح الرقم قابلًا للاتصال في الحملات القادمة."
        confirmLabel="إزالة"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

export function CampaignIcon() {
  return <Megaphone size={15} />
}

export function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <Pill tone={tone as 'neutral' | 'signal' | 'good' | 'warn'}>{label}</Pill>
}
