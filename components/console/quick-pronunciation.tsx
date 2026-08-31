'use client'

import { BookmarkPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { addPronunciation } from '@/server/actions/console'

const CATEGORIES = [
  { value: 'brand', label: 'علامة تجارية' },
  { value: 'person', label: 'اسم شخص' },
  { value: 'area', label: 'منطقة أو فرع' },
  { value: 'service', label: 'خدمة' },
  { value: 'medicine', label: 'مصطلح متخصص / دواء' },
] as const

/**
 * Bible §14: from Call Detail, QA flags a mispronounced word straight into
 * the pronunciation dictionary — before this, the only entry point was the
 * general "أضف نطقًا" form on Voice Lab, disconnected from the call that
 * actually surfaced the problem. This pre-fills the client so a reviewer
 * only has to type the word and how it should sound.
 */
export function QuickPronunciationFix({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string
  workspaceName: string
}) {
  const [open, setOpen] = useState(false)
  const [canonical, setCanonical] = useState('')
  const [spokenHint, setSpokenHint] = useState('')
  const [category, setCategory] = useState<string>('person')
  const { run, pending } = useAction()

  function reset() {
    setCanonical('')
    setSpokenHint('')
  }

  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        leading={<BookmarkPlus size={14} aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        أضف كلمة للقاموس
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة مدخل نطق"
        description={`لـ${workspaceName} — الكلمة التي أخطأ الموظف الصوتي في نطقها خلال هذه المكالمة.`}
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || !canonical.trim() || !spokenHint.trim()}
              onClick={() =>
                run(
                  () =>
                    addPronunciation({
                      workspaceId,
                      canonical,
                      spokenHint,
                      category: category as (typeof CATEGORIES)[number]['value'],
                    }),
                  () => {
                    setOpen(false)
                    reset()
                  },
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'أضف كمسودة'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="qp-canonical">الكلمة كما تُكتب</label>
          <input
            id="qp-canonical"
            className="input"
            value={canonical}
            onChange={(e) => setCanonical(e.target.value)}
            placeholder="د. عبدالمحسن القحطاني"
          />
        </div>
        <div className="field" style={{ marginBlockStart: 'var(--s-3)' }}>
          <label htmlFor="qp-hint">كيف يجب أن تُنطق</label>
          <input
            id="qp-hint"
            className="input"
            value={spokenHint}
            onChange={(e) => setSpokenHint(e.target.value)}
            placeholder="دكتور عبد-المحسن القحطاني"
          />
          <span className="field__hint">اكتبها كما تُقال بصوت عالٍ، بمقاطع إن لزم.</span>
        </div>
        <div className="field" style={{ marginBlockStart: 'var(--s-3)' }}>
          <label htmlFor="qp-category">النوع</label>
          <select
            id="qp-category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <p className="muted" style={{ fontSize: 'var(--step--1)', marginBlockStart: 'var(--s-3)' }}>
          يُحفظ كمسودة بانتظار اعتماد فريق الصوت من مختبر الصوت قبل أن يدخل النسخة التالية.
        </p>
      </Sheet>
    </>
  )
}
