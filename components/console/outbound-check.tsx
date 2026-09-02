'use client'

import { MessageSquare, PhoneCall } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { runOutboundSelfTest } from '@/server/actions/demo-call'

/**
 * Proving the outbound path, rather than reasoning about it.
 *
 * This deployment has never sent an SMS or placed a call. Everything written
 * about that path follows the providers' documentation, which is not the same
 * as knowing it works — and the difference is one button and one number the
 * operator owns.
 *
 * Both tests reach real providers and cost real money, so the call sits behind
 * a confirmation naming the number. The SMS does not: one message to your own
 * phone is the cheapest possible way to find out that a `+1` sender cannot
 * deliver to a Saudi handset.
 */

export function OutboundSelfTest({
  smsReady,
  dialerReady,
  problems,
}: {
  smsReady: boolean
  dialerReady: boolean
  problems: string[]
}) {
  const [phone, setPhone] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { run, pending } = useAction()

  const usable = phone.trim().length >= 6

  return (
    <div className="stack">
      {problems.length > 0 ? (
        <div className="notice notice--warn" role="status">
          <strong>الإعداد ناقص</strong>
          <p>{problems.join(' · ')}</p>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="selftest-phone">رقمك أنت</label>
        <input
          id="selftest-phone"
          className="input"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+9665XXXXXXXX"
        />
        {/*
          Said plainly, because the alternative is testing on a customer. The
          first real use of an untested outbound path should be a number whose
          owner is in the room.
        */}
        <span className="hint">
          اكتب رقمًا تملكه. هذا اختبار حقيقي — رسالة حقيقية أو مكالمة حقيقية، بتكلفة حقيقية.
        </span>
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          leading={<MessageSquare size={15} />}
          disabled={pending || !usable || !smsReady}
          title={smsReady ? undefined : 'SMS غير مُهيّأ'}
          onClick={() => run(() => runOutboundSelfTest({ phone, kind: 'sms' }))}
        >
          {pending ? 'جارٍ…' : 'أرسل رسالة اختبار'}
        </Button>

        <Button
          size="sm"
          variant="primary"
          leading={<PhoneCall size={15} />}
          disabled={pending || !usable || !dialerReady}
          title={dialerReady ? undefined : 'الاتصال الصادر غير مُهيّأ'}
          onClick={() => setConfirming(true)}
        >
          اتصل بي الآن
        </Button>
      </div>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          run(
            () => runOutboundSelfTest({ phone, kind: 'call' }),
            () => setConfirming(false),
          )
        }
        title="إجراء مكالمة اختبار حقيقية؟"
        body={`سيتصل مُجاوِب بـ ${phone} خلال ثوانٍ. هذه أول مكالمة صادرة من هذا الخادم — تأكد أن الرقم رقمك.`}
        confirmLabel="اتصل"
        pending={pending}
      />
    </div>
  )
}
