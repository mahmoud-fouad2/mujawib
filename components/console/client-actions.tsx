'use client'

import { Pencil, Radio, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActionSeparator, RowActions, useAction } from '@/components/ui/row-actions'
import { updateClient } from '@/server/actions/console'

const STATUSES = [
  { value: 'discovery', label: 'اكتشاف — نجمع المتطلبات' },
  { value: 'setup', label: 'إعداد — نبني الموظف الصوتي' },
  { value: 'pilot', label: 'تجريبي — يعمل على نطاق محدود' },
  { value: 'live', label: 'تشغيل — يستقبل كل المكالمات' },
  { value: 'paused', label: 'موقوف — المكالمات تذهب للفريق' },
] as const

export function ClientRowActions({
  workspaceId,
  name,
  status,
  city,
  hoursWeekday,
  transferTo,
}: {
  workspaceId: string
  name: string
  status: string
  city: string
  hoursWeekday: string
  transferTo: string
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name, status, city, hoursWeekday, transferTo })
  const { run, pending } = useAction()

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <>
      <RowActions>
        <RowAction icon={<Pencil size={15} />} onClick={() => setOpen(true)}>
          عدّل البيانات
        </RowAction>
        <RowActionSeparator />
        <RowAction icon={<Radio size={15} />} onClick={() => {}}>
          <Link href="/console/live">شاهد مكالماته المباشرة</Link>
        </RowAction>
        <RowAction icon={<Users size={15} />} onClick={() => {}}>
          <Link href="/portal">افتح بوابته</Link>
        </RowAction>
      </RowActions>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`تعديل ${name}`}
        description="الحالة تتحكم في استقبال المكالمات، والباقي يستخدمه المُجاوِب أثناء المكالمة."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || form.name.trim().length < 2}
              onClick={() =>
                run(
                  () =>
                    updateClient({
                      workspaceId,
                      name: form.name,
                      status: form.status as (typeof STATUSES)[number]['value'],
                      city: form.city,
                      hoursWeekday: form.hoursWeekday,
                      transferTo: form.transferTo,
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
          <label htmlFor={`c-name-${workspaceId}`}>اسم الشركة كما يُنطق</label>
          <input
            id={`c-name-${workspaceId}`}
            className="input"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={`c-status-${workspaceId}`}>الحالة</label>
          <select
            id={`c-status-${workspaceId}`}
            className="input"
            value={form.status}
            onChange={(e) => set('status')(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {form.status === 'paused' ? (
            <span className="field__error">
              الإيقاف يحوّل كل المكالمات الواردة إلى رقم فريقك مباشرة.
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={`c-city-${workspaceId}`}>المدينة</label>
          <input
            id={`c-city-${workspaceId}`}
            className="input"
            value={form.city}
            onChange={(e) => set('city')(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={`c-hours-${workspaceId}`}>ساعات العمل (الأحد – الخميس)</label>
          <input
            id={`c-hours-${workspaceId}`}
            className="input mono"
            value={form.hoursWeekday}
            onChange={(e) => set('hoursWeekday')(e.target.value)}
            placeholder="09:00–21:00"
          />
        </div>

        <div className="field">
          <label htmlFor={`c-transfer-${workspaceId}`}>رقم التحويل</label>
          <input
            id={`c-transfer-${workspaceId}`}
            className="input mono"
            value={form.transferTo}
            onChange={(e) => set('transferTo')(e.target.value)}
            placeholder="+966551200430"
          />
        </div>
      </Sheet>
    </>
  )
}
