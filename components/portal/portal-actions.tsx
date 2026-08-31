'use client'

import { Clock, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  addService,
  cancelChangeRequest,
  createChangeRequest,
  removeService,
  updateOpeningHours,
} from '@/server/actions/portal'

/* ─── change requests ────────────────────────────────────────────────────── */

const TYPES = [
  { value: 'business_info', label: 'تحديث بيانات (أسعار، فروع، ساعات)' },
  { value: 'new_service', label: 'إضافة خدمة جديدة' },
  { value: 'behavior', label: 'تعديل أسلوب المكالمة' },
  { value: 'pronunciation', label: 'تصحيح نطق كلمة' },
  { value: 'integration', label: 'ربط نظام جديد' },
] as const

export function NewRequestButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>('business_info')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const { run, pending } = useAction()

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        اطلب تعديلًا
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="طلب تعديل"
        description="اكتب ما تريد تغييره، ويتولى فريق مُجاوِب التنفيذ والاختبار قبل التشغيل."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || title.trim().length < 4}
              onClick={() =>
                run(
                  () =>
                    createChangeRequest({
                      workspaceId,
                      type: type as (typeof TYPES)[number]['value'],
                      title,
                      description: description.trim() || undefined,
                    }),
                  () => {
                    setOpen(false)
                    setTitle('')
                    setDescription('')
                  },
                )
              }
            >
              {pending ? 'جارٍ الإرسال…' : 'أرسل الطلب'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="req-type">نوع الطلب</label>
          <select
            id="req-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="req-title">ما الذي تريد تغييره؟</label>
          <input
            id="req-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="تحديث ساعات العمل في رمضان"
          />
        </div>

        <div className="field">
          <label htmlFor="req-desc">تفاصيل (اختياري)</label>
          <textarea
            id="req-desc"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="من 10 صباحًا إلى 4 عصرًا، ثم من 9 مساءً إلى منتصف الليل."
          />
        </div>
      </Sheet>
    </>
  )
}

export function RequestRowActions({
  id,
  title,
  status,
}: {
  id: string
  title: string
  status: string
}) {
  const [confirm, setConfirm] = useState(false)
  const { run, pending } = useAction()
  const done = status === 'live' || status === 'rejected'

  return (
    <>
      <RowActions>
        <RowAction
          icon={<X size={15} />}
          tone="danger"
          onClick={() => setConfirm(true)}
          disabled={done}
          title={done ? 'الطلب مغلق' : undefined}
        >
          اسحب الطلب
        </RowAction>
      </RowActions>

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          run(
            () => cancelChangeRequest(id),
            () => setConfirm(false),
          )
        }
        title={`سحب «${title}»؟`}
        body="سيتوقف الفريق عن العمل على هذا الطلب. يمكنك إرساله من جديد في أي وقت."
        confirmLabel="اسحب الطلب"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

/* ─── opening hours ──────────────────────────────────────────────────────── */

export function EditHoursButton({
  workspaceId,
  hoursWeekday,
  hoursWeekend,
}: {
  workspaceId: string
  hoursWeekday: string
  hoursWeekend: string
}) {
  const [open, setOpen] = useState(false)
  const [weekday, setWeekday] = useState(hoursWeekday)
  const [weekend, setWeekend] = useState(hoursWeekend)
  const { run, pending } = useAction()

  return (
    <>
      <Button size="sm" leading={<Clock size={15} />} onClick={() => setOpen(true)}>
        عدّل الساعات
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="ساعات العمل"
        description="يعمل المُجاوِب بها فورًا — خارجها يسجّل طلب معاودة اتصال بدل ترك المتصل بلا رد."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || weekday.trim().length < 3}
              onClick={() =>
                run(
                  () =>
                    updateOpeningHours({
                      workspaceId,
                      hoursWeekday: weekday,
                      hoursWeekend: weekend.trim() || undefined,
                    }),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'احفظ'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="h-weekday">الأحد – الخميس</label>
          <input
            id="h-weekday"
            className="input mono"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            placeholder="09:00–21:00"
          />
        </div>
        <div className="field">
          <label htmlFor="h-weekend">السبت</label>
          <input
            id="h-weekend"
            className="input mono"
            value={weekend}
            onChange={(e) => setWeekend(e.target.value)}
            placeholder="مغلق"
          />
        </div>
      </Sheet>
    </>
  )
}

/* ─── services ───────────────────────────────────────────────────────────── */

export function AddServiceButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [body, setBody] = useState('')
  const [suitableFor, setSuitableFor] = useState('')
  const [requirements, setRequirements] = useState('')
  const [preparation, setPreparation] = useState('')
  const [aftercare, setAftercare] = useState('')
  const [outcome, setOutcome] = useState('')
  const [availability, setAvailability] = useState('')
  const [owner, setOwner] = useState('')
  const [branch, setBranch] = useState('')
  const { run, pending } = useAction()
  const reset = () => {
    setTitle('')
    setPrice('')
    setDuration('')
    setBody('')
    setSuitableFor('')
    setRequirements('')
    setPreparation('')
    setAftercare('')
    setOutcome('')
    setAvailability('')
    setOwner('')
    setBranch('')
  }

  return (
    <>
      <Button size="sm" leading={<Plus size={15} />} onClick={() => setOpen(true)}>
        أضف خدمة
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة خدمة"
        description="بمجرد الحفظ يبدأ المُجاوِب بذكرها وسعرها للمتصلين."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || title.trim().length < 2}
              onClick={() =>
                run(
                  () =>
                    addService({
                      workspaceId,
                      title,
                      price: price.trim() || undefined,
                      duration: duration.trim() || undefined,
                      body: body.trim() || undefined,
                      suitableFor: suitableFor.trim() || undefined,
                      requirements: requirements.trim() || undefined,
                      preparation: preparation.trim() || undefined,
                      aftercare: aftercare.trim() || undefined,
                      outcome: outcome.trim() || undefined,
                      availability: availability.trim() || undefined,
                      owner: owner.trim() || undefined,
                      branch: branch.trim() || undefined,
                    }),
                  () => {
                    setOpen(false)
                    reset()
                  },
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'أضف'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <div className="field">
            <label htmlFor="svc-title">اسم الخدمة أو المنتج</label>
            <input
              id="svc-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="استشارة أولية / باقة صيانة / عرض تمويل"
            />
          </div>
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-price">السعر</label>
              <input
                id="svc-price"
                className="input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250 ر.س"
              />
              <span className="field__hint">اتركه فارغًا ليقول المُجاوِب «حسب الحالة».</span>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-duration">المدة</label>
              <input
                id="svc-duration"
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30 دقيقة"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="svc-body">شرح مختصر يقوله الموظف الصوتي</label>
            <textarea
              id="svc-body"
              className="input"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب الوصف المعتمد بدون وعود أو معلومات غير مؤكدة."
            />
          </div>
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-suitable">لمن تناسب</label>
              <input
                id="svc-suitable"
                className="input"
                value={suitableFor}
                onChange={(e) => setSuitableFor(e.target.value)}
                placeholder="العميل المناسب أو الحالة المناسبة"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-outcome">النتيجة المتوقعة</label>
              <input
                id="svc-outcome"
                className="input"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="ماذا يحصل عليه العميل؟"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="svc-requirements">المتطلبات أو الشروط قبل التنفيذ</label>
            <input
              id="svc-requirements"
              className="input"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="مستندات، تجهيزات، موافقات، أو شروط مسبقة"
            />
          </div>
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-preparation">التحضير</label>
              <input
                id="svc-preparation"
                className="input"
                value={preparation}
                onChange={(e) => setPreparation(e.target.value)}
                placeholder="تعليمات قبل الموعد أو الطلب"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-aftercare">ما بعد الخدمة</label>
              <input
                id="svc-aftercare"
                className="input"
                value={aftercare}
                onChange={(e) => setAftercare(e.target.value)}
                placeholder="متابعة، ضمان، تعليمات، أو تسليم"
              />
            </div>
          </div>
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-availability">التوفر</label>
              <input
                id="svc-availability"
                className="input"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="الأيام، الفروع، أو الحالات المتاحة"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="svc-owner">المسؤول أو المختص</label>
              <input
                id="svc-owner"
                className="input"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="اسم الفريق أو المختص"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="svc-branch">الفرع أو الموقع</label>
            <input
              id="svc-branch"
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="الفرع أو المنطقة التي تتوفر فيها"
            />
          </div>
        </div>
      </Sheet>
    </>
  )
}

export function ServiceRowActions({ id, title }: { id: string; title: string }) {
  const [confirm, setConfirm] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<Trash2 size={15} />} tone="danger" onClick={() => setConfirm(true)}>
          احذف
        </RowAction>
      </RowActions>

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          run(
            () => removeService(id),
            () => setConfirm(false),
          )
        }
        title={`حذف «${title}»؟`}
        body="سيتوقف المُجاوِب عن ذكر هذه الخدمة للمتصلين فورًا."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
