'use client'

import { CircleCheck, CircleDashed, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { Pill } from '@/components/ui/primitives'
import { useAction } from '@/components/ui/row-actions'
import { updatePlatformContact } from '@/server/actions/console'

export type PlatformContactRow = {
  email: string
  emailConfirmed: boolean
  phoneE164: string
  phoneDisplay: string
  phoneConfirmed: boolean
  whatsappEnabled: boolean
}

/**
 * Confirming a channel here is a factual claim, not form validation — the
 * checkboxes exist to make an operator state that claim deliberately rather
 * than have a channel go live because a field happened to be non-empty. An
 * unconfirmed row is exactly as safe as an empty one: the site shows neither.
 */
export function PlatformContactSettings({
  canEdit,
  initial,
}: {
  canEdit: boolean
  initial: PlatformContactRow
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initial)
  const { run, pending } = useAction()

  const set = (key: keyof PlatformContactRow) => (value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  return (
    <>
      <div className="platform-contact">
        <div className="platform-contact__row">
          <Pill tone={initial.emailConfirmed ? 'good' : 'warn'}>
            {initial.emailConfirmed ? <CircleCheck size={13} /> : <CircleDashed size={13} />}
            {initial.emailConfirmed ? 'مؤكَّد' : 'غير مؤكَّد'}
          </Pill>
          <div>
            <strong>البريد الإلكتروني</strong>
            <span className="mono">{initial.email || '—'}</span>
          </div>
        </div>
        <div className="platform-contact__row">
          <Pill tone={initial.phoneConfirmed ? 'good' : 'warn'}>
            {initial.phoneConfirmed ? <CircleCheck size={13} /> : <CircleDashed size={13} />}
            {initial.phoneConfirmed ? 'مؤكَّد' : 'غير مؤكَّد'}
          </Pill>
          <div>
            <strong>رقم الهاتف</strong>
            <span className="mono">{initial.phoneDisplay || '—'}</span>
            {initial.phoneConfirmed && initial.whatsappEnabled ? (
              <span className="platform-contact__note">واتساب مفعّل على هذا الرقم</span>
            ) : null}
          </div>
        </div>
        {!initial.emailConfirmed || !initial.phoneConfirmed ? (
          <p className="platform-contact__hint">
            القناة غير المؤكَّدة لا تُعرض للزوار كوسيلة تواصل حقيقية — يظهر نموذج التواصل بدلًا منها.
          </p>
        ) : null}
      </div>

      {canEdit ? (
        <Button size="sm" leading={<Pencil size={15} />} onClick={() => setOpen(true)}>
          تعديل
        </Button>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="قنوات التواصل العامة"
        description="ما يظهر للزوار على الموقع، وفي بيانات محركات البحث. أكِّد القناة فقط بعد التحقق فعليًا أنها تستقبل وتُجاب."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updatePlatformContact({
                      email: form.email,
                      emailConfirmed: form.emailConfirmed,
                      phoneE164: form.phoneE164,
                      phoneDisplay: form.phoneDisplay,
                      phoneConfirmed: form.phoneConfirmed,
                      whatsappEnabled: form.whatsappEnabled,
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
        <div className="sheet__group">
          <h3>البريد الإلكتروني</h3>
          <div className="field">
            <label htmlFor="pc-email">العنوان</label>
            <input
              id="pc-email"
              className="input mono"
              dir="ltr"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              placeholder="hello@example.com"
            />
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.emailConfirmed}
              onChange={(e) => set('emailConfirmed')(e.target.checked)}
            />
            <span>
              أؤكِّد أن هذا البريد يستقبل رسائل فعليًا ويُتابَع
              <small>لا تفعّلها لعنوان لم يُختبر بعد.</small>
            </span>
          </label>
        </div>

        <div className="sheet__group">
          <h3>رقم الهاتف</h3>
          <div className="field">
            <label htmlFor="pc-phone-e164">الرقم بصيغة دولية</label>
            <input
              id="pc-phone-e164"
              className="input mono"
              dir="ltr"
              value={form.phoneE164}
              onChange={(e) => set('phoneE164')(e.target.value)}
              placeholder="+966920012130"
            />
          </div>
          <div className="field">
            <label htmlFor="pc-phone-display">الشكل المعروض</label>
            <input
              id="pc-phone-display"
              className="input mono"
              dir="ltr"
              value={form.phoneDisplay}
              onChange={(e) => set('phoneDisplay')(e.target.value)}
              placeholder="+966 920 012 130"
            />
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.phoneConfirmed}
              onChange={(e) => set('phoneConfirmed')(e.target.checked)}
            />
            <span>
              أؤكِّد أن هذا الرقم مُفعَّل ويُرد عليه
              <small>يشمل الرد الصوتي أو الفريق — ليس بالضرورة مُجاوِب نفسه.</small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.whatsappEnabled}
              disabled={!form.phoneConfirmed}
              onChange={(e) => set('whatsappEnabled')(e.target.checked)}
            />
            <span>
              واتساب فعّال على هذا الرقم
              <small>
                {form.phoneConfirmed ? 'يظهر رابط واتساب في نموذج التواصل.' : 'أكِّد الرقم أولًا.'}
              </small>
            </span>
          </label>
        </div>
      </Sheet>
    </>
  )
}
