import { AudioLines, CircleAlert, LoaderCircle } from 'lucide-react'

export function RecordingPlayer({ callId, status }: { callId: string; status: string }) {
  if (status === 'capturing' || status === 'processing') {
    return (
      <section className="recording-player recording-player--pending" aria-live="polite">
        <LoaderCircle size={18} className="recording-player__spinner" aria-hidden="true" />
        <div>
          <strong>{status === 'capturing' ? 'التسجيل جارٍ الآن' : 'جارٍ تجهيز التسجيل'}</strong>
          <span>سيصبح الاستماع متاحًا هنا بعد انتهاء المعالجة الآمنة.</span>
        </div>
      </section>
    )
  }

  if (status !== 'ready' && status !== 'partial') return null

  return (
    <section className="recording-player">
      <div className="recording-player__head">
        <AudioLines size={19} aria-hidden="true" />
        <div>
          <strong>تسجيل المكالمة</strong>
          <span>يُبث عبر مُجاوِب بعد التحقق من صلاحيات الحساب.</span>
        </div>
        {status === 'partial' ? (
          <span className="recording-player__partial" title="قد لا يشمل التسجيل كامل المكالمة">
            <CircleAlert size={14} aria-hidden="true" />
            تسجيل جزئي
          </span>
        ) : null}
      </div>
      <audio controls preload="metadata" src={`/api/calls/${encodeURIComponent(callId)}/recording`}>
        <track kind="captions" />
      </audio>
    </section>
  )
}
