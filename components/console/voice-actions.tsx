'use client'

import { Check, Plus, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { RowAction, RowActionSeparator, RowActions, useAction } from '@/components/ui/row-actions'
import {
  addPronunciation,
  deletePronunciation,
  setPronunciationStatus,
} from '@/server/actions/console'

const CATEGORIES = [
  { value: 'brand', label: 'علامة تجارية' },
  { value: 'person', label: 'اسم شخص' },
  { value: 'area', label: 'منطقة أو فرع' },
  { value: 'service', label: 'خدمة' },
  { value: 'medicine', label: 'مصطلح متخصص / دواء' },
] as const

/* ─── add ────────────────────────────────────────────────────────────────── */

export function AddPronunciation({ workspaces }: { workspaces: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [canonical, setCanonical] = useState('')
  const [arabicDisplay, setArabicDisplay] = useState('')
  const [spokenHint, setSpokenHint] = useState('')
  const [category, setCategory] = useState<string>('brand')
  const { run, pending } = useAction()

  function reset() {
    setCanonical('')
    setArabicDisplay('')
    setSpokenHint('')
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        أضف نطقًا
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة مدخل نطق"
        description="الكلمات التي يخطئ المُجاوِب في نطقها — أسماء المختصين، الفروع، والعلامات."
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
                      arabicDisplay: arabicDisplay.trim() || undefined,
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
              {pending ? 'جارٍ الحفظ…' : 'أضف'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="pron-ws">العميل</label>
          <select
            id="pron-ws"
            className="input"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pron-canonical">الكلمة كما تُكتب</label>
          <input
            id="pron-canonical"
            className="input"
            value={canonical}
            onChange={(e) => setCanonical(e.target.value)}
            placeholder="Rejuvera"
          />
        </div>

        <div className="field">
          <label htmlFor="pron-display">كتابتها بالعربية (اختياري)</label>
          <input
            id="pron-display"
            className="input"
            value={arabicDisplay}
            onChange={(e) => setArabicDisplay(e.target.value)}
            placeholder="ريجوفيرا"
          />
        </div>

        <div className="field">
          <label htmlFor="pron-hint">كيف تُنطق</label>
          <input
            id="pron-hint"
            className="input"
            value={spokenHint}
            onChange={(e) => setSpokenHint(e.target.value)}
            placeholder="ري-جو-في-را"
          />
          <span className="field__hint">افصل المقاطع بشرطة كما تريد أن تُسمع في المكالمة.</span>
        </div>

        <div className="field">
          <label htmlFor="pron-cat">التصنيف</label>
          <select
            id="pron-cat"
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
      </Sheet>
    </>
  )
}

/* ─── row ────────────────────────────────────────────────────────────────── */

export function PronunciationRowActions({
  id,
  word,
  status,
}: {
  id: string
  word: string
  status: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction
          icon={<Check size={15} />}
          onClick={() => run(() => setPronunciationStatus(id, 'approved'))}
          disabled={status === 'approved'}
        >
          اعتمد
        </RowAction>
        <RowAction
          icon={<X size={15} />}
          onClick={() => run(() => setPronunciationStatus(id, 'rejected'))}
          disabled={status === 'rejected'}
        >
          ارفض
        </RowAction>
        <RowAction
          icon={<Undo2 size={15} />}
          onClick={() => run(() => setPronunciationStatus(id, 'draft'))}
          disabled={status === 'draft'}
        >
          أرجعه لمسودة
        </RowAction>
        <RowActionSeparator />
        <RowAction icon={<Trash2 size={15} />} tone="danger" onClick={() => setConfirmDelete(true)}>
          احذف
        </RowAction>
      </RowActions>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(
            () => deletePronunciation(id),
            () => setConfirmDelete(false),
          )
        }
        title={`حذف «${word}»؟`}
        body="سيعود المُجاوِب لنطق هذه الكلمة تلقائيًا كما يقرؤها. لا يمكن التراجع عن الحذف."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
