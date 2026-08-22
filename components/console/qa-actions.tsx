'use client'

import { Check, ExternalLink, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActionSeparator, RowActions, useAction } from '@/components/ui/row-actions'
import { reopenReview, resolveReview } from '@/server/actions/console'

const OUTCOMES = [
  { value: 'good', label: 'مكالمة سليمة — لا يلزم تعديل' },
  { value: 'pronunciation_fix', label: 'تصحيح نطق' },
  { value: 'knowledge_gap', label: 'فجوة معرفية' },
  { value: 'flow_issue', label: 'مشكلة في المسار' },
  { value: 'tool_issue', label: 'مشكلة في أداة' },
  { value: 'false_flag', label: 'إنذار خاطئ' },
] as const

export function QaRowActions({
  qaId,
  callId,
  closed,
}: {
  qaId: string
  callId: string
  closed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<string>('good')
  const [notes, setNotes] = useState('')
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction
          icon={<Check size={15} />}
          onClick={() => setOpen(true)}
          disabled={closed}
          title={closed ? 'أُغلقت بالفعل' : undefined}
        >
          إغلاق المراجعة
        </RowAction>
        <RowAction
          icon={<RotateCcw size={15} />}
          onClick={() => run(() => reopenReview(qaId))}
          disabled={!closed}
        >
          إعادة الفتح
        </RowAction>
        <RowActionSeparator />
        <RowAction icon={<ExternalLink size={15} />} href={`/console/calls?call=${callId}`}>
          فتح المكالمة
        </RowAction>
      </RowActions>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إغلاق المراجعة"
        description="سجّل ما وجدته حتى يعرف الفريق ما الذي يجب تعديله في النسخة القادمة."
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
                    resolveReview({
                      qaId,
                      action: outcome as (typeof OUTCOMES)[number]['value'],
                      notes: notes.trim() || undefined,
                    }),
                  () => {
                    setOpen(false)
                    setNotes('')
                  },
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'إغلاق المراجعة'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor={`qa-outcome-${qaId}`}>ما الذي وجدته؟</label>
          <select
            id={`qa-outcome-${qaId}`}
            className="input"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="field__hint">
            هذا التصنيف هو ما يظهر في تقرير أسباب المراجعة، ويحدّد أين يذهب الإصلاح.
          </span>
        </div>

        <div className="field">
          <label htmlFor={`qa-notes-${qaId}`}>ملاحظات (اختياري)</label>
          <textarea
            id={`qa-notes-${qaId}`}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: نطق اسم الفرع غير صحيح في الثانية 0:24."
            maxLength={600}
          />
        </div>
      </Sheet>
    </>
  )
}
