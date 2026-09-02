'use client'

import { Check, Play, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { reviewCampaign, startCampaign } from '@/server/actions/campaigns'

/**
 * The operator's half: approve, reject, and the one control in the product
 * that causes a phone to ring.
 *
 * Starting is deliberately behind a confirmation that states the numbers
 * involved. It is the only irreversible action here — an approval can be
 * withdrawn, a rejection can be revised, but a call that has been placed has
 * been placed.
 */

export function ReviewCampaign({ campaignId }: { campaignId: string }) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const { run, pending } = useAction()

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Check size={15} />}
        onClick={() => setMode('approve')}
      >
        اعتماد
      </Button>
      <Button size="sm" leading={<X size={15} />} onClick={() => setMode('reject')}>
        رفض
      </Button>

      {mode ? (
        <Sheet
          open
          onClose={() => setMode(null)}
          title={mode === 'approve' ? 'اعتماد الحملة' : 'رفض الحملة'}
          description={
            mode === 'approve'
              ? 'الاعتماد يسمح بالتشغيل لاحقًا — لا يبدأ المكالمات بنفسه.'
              : 'اكتب سببًا واضحًا؛ يظهر للعميل كما كتبته.'
          }
          footer={
            <>
              <Button onClick={() => setMode(null)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant={mode === 'approve' ? 'primary' : 'danger'}
                disabled={pending || (mode === 'reject' && note.trim().length < 5)}
                onClick={() =>
                  run(
                    () => reviewCampaign(campaignId, mode, note),
                    () => {
                      setMode(null)
                      setNote('')
                    },
                  )
                }
              >
                {pending ? 'جارٍ الحفظ…' : mode === 'approve' ? 'اعتماد' : 'رفض'}
              </Button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="review-note">
              {mode === 'approve' ? 'ملاحظة (اختيارية)' : 'سبب الرفض'}
            </label>
            <textarea
              id="review-note"
              className="input"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'approve'
                  ? 'راجعت النص والقائمة والأوقات.'
                  : 'القائمة تحتوي أرقامًا لا يوجد سجل تعامل معها.'
              }
            />
          </div>
          {mode === 'approve' ? (
            <p className="hint">
              راجع قبل الاعتماد: مصدر القائمة، الأساس القانوني، نص المكالمة، الادعاءات الممنوعة،
              وأوقات الاتصال.
            </p>
          ) : null}
        </Sheet>
      ) : null}
    </>
  )
}

export function StartCampaign({
  campaignId,
  contactCount,
  dialerReady,
}: {
  campaignId: string
  contactCount: number
  dialerReady: boolean
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Play size={15} />}
        disabled={!dialerReady}
        title={dialerReady ? undefined : 'الاتصال الصادر غير مُهيّأ على هذا الخادم'}
        onClick={() => setOpen(true)}
      >
        تشغيل
      </Button>
      <Confirm
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          run(
            () => startCampaign(campaignId),
            () => setOpen(false),
          )
        }
        title="بدء الاتصال بأرقام حقيقية؟"
        body={`ستبدأ المنصة الاتصال بـ ${contactCount} رقمًا داخل نافذة الاتصال المحددة، بدءًا بمكالمة واحدة ثم تصاعديًا. يمكن الإيقاف في أي لحظة.`}
        confirmLabel="ابدأ"
        pending={pending}
      />
    </>
  )
}
