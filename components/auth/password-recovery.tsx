'use client'

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function PasswordResetRequest() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const result = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setPending(false)

    if (result.error) {
      setError(
        result.error.code === 'RESET_PASSWORD_DISABLED'
          ? 'خدمة البريد غير مهيأة بعد. تواصل مع فريق التشغيل لاستعادة الدخول.'
          : 'تعذر إرسال الرابط الآن. حاول مرة أخرى أو تواصل مع فريق التشغيل.',
      )
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="recovery-result" role="status">
        <CheckCircle2 size={26} aria-hidden="true" />
        <div>
          <h1>تحقق من بريدك.</h1>
          <p>
            إذا كان البريد مرتبطًا بحساب مُجاوِب، ستصلك رسالة صالحة لمدة ساعة. لم نعرض ما إذا كان
            الحساب موجودًا حفاظًا على الخصوصية.
          </p>
        </div>
        <Link href="/sign-in" className="btn btn--primary">
          العودة لتسجيل الدخول
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="auth__head">
        <h1>استعادة كلمة المرور</h1>
        <p>أدخل بريد الحساب وسنرسل رابطًا آمنًا صالحًا لمدة ساعة.</p>
      </div>
      {error ? (
        <p className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <form className="auth__form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="recovery-email">البريد الإلكتروني</label>
          <input
            id="recovery-email"
            className="input mono"
            dir="ltr"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={pending}
          trailing={pending ? <Loader2 size={17} className="spin" /> : <ArrowLeft size={17} />}
        >
          {pending ? 'جارٍ الإرسال…' : 'أرسل رابط الاستعادة'}
        </Button>
      </form>
      <p className="auth__foot">
        تذكرت كلمة المرور؟ <Link href="/sign-in">العودة للدخول</Link>.
      </p>
    </>
  )
}

export function PasswordResetForm({ token, invalid }: { token: string; invalid: boolean }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(
    invalid || !token ? 'الرابط غير صالح أو انتهت مدته. اطلب رابطًا جديدًا.' : null,
  )
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }
    setPending(true)
    setError(null)
    const result = await authClient.resetPassword({ newPassword: password, token })
    setPending(false)
    if (result.error) {
      setError('الرابط غير صالح أو انتهت مدته. اطلب رابطًا جديدًا.')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="recovery-result" role="status">
        <CheckCircle2 size={26} aria-hidden="true" />
        <div>
          <h1>تم تحديث كلمة المرور.</h1>
          <p>أُغلقت الجلسات القديمة. استخدم كلمة المرور الجديدة للدخول من جديد.</p>
        </div>
        <Link href="/sign-in" className="btn btn--primary">
          تسجيل الدخول
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="auth__head">
        <h1>اختر كلمة مرور جديدة</h1>
        <p>استخدم 10 أحرف على الأقل، وتجنب كلمة مستخدمة في حساب آخر.</p>
      </div>
      {error ? (
        <p className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {!invalid && token ? (
        <form className="auth__form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="new-password">كلمة المرور الجديدة</label>
            <PasswordField
              id="new-password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
            <PasswordField
              id="confirm-password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" block disabled={pending}>
            {pending ? 'جارٍ التحديث…' : 'حفظ كلمة المرور الجديدة'}
          </Button>
        </form>
      ) : (
        <Link href="/forgot-password" className="btn btn--primary">
          اطلب رابطًا جديدًا
        </Link>
      )}
    </>
  )
}
