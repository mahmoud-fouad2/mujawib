'use client'

import { AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { safeInternalPath } from '@/lib/navigation'

export function TwoFactorChallenge() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [method, setMethod] = useState<'totp' | 'backup'>('totp')
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verify(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const normalizedCode = code.trim().replaceAll(' ', '')
    const result =
      method === 'totp'
        ? await authClient.twoFactor.verifyTotp({ code: normalizedCode, trustDevice })
        : await authClient.twoFactor.verifyBackupCode({
            code: normalizedCode,
            trustDevice,
            disableSession: false,
          })

    if (result.error) {
      setError('الرمز غير صحيح أو انتهت صلاحيته. تحقق منه وحاول مرة أخرى.')
      setPending(false)
      return
    }

    const requested = searchParams.get('next') ?? searchParams.get('callbackURL')
    router.replace(safeInternalPath(requested, '/auth/continue'))
    router.refresh()
  }

  return (
    <div className="two-factor-challenge">
      <div className="auth__head">
        <span className="security-mark" aria-hidden="true">
          <ShieldCheck size={22} />
        </span>
        <h1>تحقق بخطوتين</h1>
        <p>أدخل الرمز من تطبيق المصادقة لإكمال تسجيل الدخول بأمان.</p>
      </div>

      <fieldset className="segmented">
        <legend className="visually-hidden">طريقة التحقق</legend>
        <button type="button" aria-pressed={method === 'totp'} onClick={() => setMethod('totp')}>
          تطبيق المصادقة
        </button>
        <button
          type="button"
          aria-pressed={method === 'backup'}
          onClick={() => setMethod('backup')}
        >
          رمز احتياطي
        </button>
      </fieldset>

      {error ? (
        <p className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <form className="auth__form" onSubmit={verify}>
        <div className="field">
          <label htmlFor="two-factor-code">
            {method === 'totp' ? 'رمز التحقق المكوّن من 6 أرقام' : 'الرمز الاحتياطي'}
          </label>
          <input
            id="two-factor-code"
            className="input mono security-code-input"
            inputMode={method === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            minLength={method === 'totp' ? 6 : 8}
            maxLength={method === 'totp' ? 6 : 32}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          الوثوق بهذا الجهاز لمدة 30 يومًا
        </label>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={pending}
          leading={pending ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
        >
          {pending ? 'جارٍ التحقق…' : 'إكمال الدخول'}
        </Button>
      </form>
    </div>
  )
}
