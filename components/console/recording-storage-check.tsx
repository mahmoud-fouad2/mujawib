'use client'

import { DatabaseZap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAction } from '@/components/ui/row-actions'
import { verifyRecordingStorage } from '@/server/actions/console'

export function RecordingStorageCheck({
  state,
  canVerify,
}: {
  state: 'ready' | 'disabled' | 'misconfigured'
  canVerify: boolean
}) {
  const { run, pending } = useAction()
  const label =
    state === 'ready'
      ? 'الإعدادات مكتملة؛ شغّل اختبار الصلاحيات الفعلي.'
      : state === 'misconfigured'
        ? 'الإعدادات موجودة لكنها غير مكتملة.'
        : 'لم تُكتشف إعدادات تخزين خاصة في بيئة التشغيل.'

  return (
    <div className="queue__row">
      <div>
        <div className="queue__title">Cloudflare R2 الخاص</div>
        <span className="muted">{label}</span>
      </div>
      {canVerify ? (
        <Button
          size="sm"
          leading={<DatabaseZap size={15} />}
          disabled={pending || state !== 'ready'}
          onClick={() => run(verifyRecordingStorage)}
        >
          {pending ? 'جارٍ الاختبار…' : 'اختبار الكتابة والقراءة والحذف'}
        </Button>
      ) : null}
    </div>
  )
}
