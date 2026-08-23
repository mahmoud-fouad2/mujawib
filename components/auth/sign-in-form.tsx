'use client'

import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { authClient, needsTwoFactor, twoFactorHref } from '@/lib/auth-client'

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

/** Better Auth error codes we can phrase properly in Arabic. */
function messageFor(code: string | undefined, fallback: string) {
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'البريد أو كلمة المرور غير صحيحة.'
    case 'USER_NOT_FOUND':
      return 'لا يوجد حساب بهذا البريد. الوصول للوحة التشغيل بدعوة من فريق مُجاوِب.'
    case 'INVALID_EMAIL':
      return 'صيغة البريد غير صحيحة.'
    default:
      return fallback
  }
}

export function SignInForm({
  googleEnabled,
  returnTo = '/console',
}: {
  googleEnabled: boolean
  returnTo?: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'email' | 'google' | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending('email')

    const continuation = `/auth/continue?next=${encodeURIComponent(returnTo)}`
    const { data, error: authError } = await authClient.signIn.email({
      email: email.trim(),
      password,
      callbackURL: continuation,
    })

    if (authError) {
      setError(messageFor(authError.code, 'تعذر تسجيل الدخول. حاول مرة أخرى.'))
      setPending(null)
      return
    }

    // The password was accepted but no session exists yet: Better Auth is
    // holding a two-factor challenge that expires in ten minutes. Carry the
    // destination across so verifying lands where the person was going.
    if (needsTwoFactor(data)) {
      router.push(twoFactorHref(continuation))
      return
    }

    router.push(continuation)
    router.refresh()
  }

  async function onGoogle() {
    setError(null)
    setPending('google')
    const continuation = `/auth/continue?next=${encodeURIComponent(returnTo)}`
    const { error: authError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: continuation,
    })
    if (authError) {
      setError('تعذر الاتصال بـ Google. حاول مرة أخرى.')
      setPending(null)
    }
  }

  return (
    <>
      {error ? (
        <p className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" style={{ flex: 'none', marginBlockStart: 2 }} />
          {error}
        </p>
      ) : null}

      {googleEnabled ? (
        <>
          <Button
            variant="default"
            size="lg"
            block
            className="btn--google"
            onClick={onGoogle}
            disabled={pending !== null}
            aria-busy={pending === 'google'}
            leading={pending === 'google' ? <Loader2 size={17} className="spin" /> : <GoogleMark />}
          >
            المتابعة بحساب Google
          </Button>
          <div className="auth__divider">
            <span>أو بالبريد</span>
          </div>
        </>
      ) : null}

      <form className="auth__form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            className="input mono"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <PasswordField
            id="password"
            autoComplete="current-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
          <Link className="field__aside-link" href="/forgot-password">
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={pending !== null}
          aria-busy={pending === 'email'}
          trailing={
            pending === 'email' ? (
              <Loader2 size={17} className="spin" aria-hidden="true" />
            ) : (
              <ArrowLeft size={17} className="arrow" aria-hidden="true" />
            )
          }
        >
          {pending === 'email' ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
        </Button>
      </form>

      <p className="auth__foot">
        الدخول مخصص لفرق العملاء المعتمدين. تحتاج إلى مساحة عمل؟{' '}
        <Link href="/contact">تحدث مع فريق مُجاوِب</Link>.
      </p>
    </>
  )
}
