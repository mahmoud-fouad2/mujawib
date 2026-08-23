'use client'

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, LogOut, MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useCallback, useEffect, useState, useTransition } from 'react'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { authClient, needsTwoFactor, twoFactorHref } from '@/lib/auth-client'
import {
  acceptWorkspaceInvitation,
  createInvitedWorkspaceAccount,
  getInvitationPreview,
} from '@/server/actions/access'

const STORAGE_KEY = 'mujawib.workspace-invitation'

type Preview = {
  workspaceName: string
  workspaceType: 'operator' | 'client'
  roleLabel: string
  maskedEmail: string
  expiresAt: string
  accountExists: boolean
}

type CurrentUser = { name: string; email: string }

function authMessage(code: string | undefined) {
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'البريد أو كلمة المرور غير صحيحة.'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'يوجد حساب بهذا البريد. اختر تسجيل الدخول بدلًا من إنشاء حساب.'
    default:
      return 'تعذر إكمال المصادقة. تحقق من البيانات وحاول مرة أخرى.'
  }
}

export function InviteAcceptance() {
  const router = useRouter()
  const toast = useToast()
  const [token, setToken] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
    const storedToken = window.sessionStorage.getItem(STORAGE_KEY) ?? ''
    const candidate = hashToken || storedToken

    if (hashToken) {
      window.sessionStorage.setItem(STORAGE_KEY, hashToken)
      window.history.replaceState(null, '', '/invite')
    }
    if (!candidate) {
      setError('رابط الدعوة غير مكتمل. اطلب رابطًا جديدًا من مدير مساحة العمل.')
      setLoading(false)
      return
    }

    setToken(candidate)
    Promise.all([getInvitationPreview(candidate), authClient.getSession()])
      .then(([invitationResult, sessionResult]) => {
        if (!invitationResult.ok) {
          window.sessionStorage.removeItem(STORAGE_KEY)
          setError(invitationResult.error)
          return
        }
        setPreview(invitationResult.invitation)
        setMode(invitationResult.invitation.accountExists ? 'sign-in' : 'sign-up')
        const user = sessionResult.data?.user
        setCurrentUser(user ? { name: user.name, email: user.email } : null)
      })
      .catch(() => setError('تعذر التحقق من الدعوة الآن. حاول مرة أخرى.'))
      .finally(() => setLoading(false))
  }, [])

  const accept = useCallback(
    async (candidate: string) => {
      const result = await acceptWorkspaceInvitation(candidate)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.sessionStorage.removeItem(STORAGE_KEY)
      toast.success(result.message)
      router.replace(result.redirectTo)
      router.refresh()
    },
    [router, toast],
  )

  function onAccept() {
    setError(null)
    startTransition(() => accept(token))
  }

  function onAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'sign-up') {
        const created = await createInvitedWorkspaceAccount({
          token,
          name: name.trim(),
          email: normalizedEmail,
          password,
        })
        if (!created.ok) {
          setError(created.error)
          return
        }

        const signedIn = await authClient.signIn.email({ email: normalizedEmail, password })
        if (signedIn.error) {
          setError('تم إنشاء الحساب، لكن تعذر بدء الجلسة. اختر تسجيل الدخول للمتابعة.')
          setMode('sign-in')
          return
        }

        window.sessionStorage.removeItem(STORAGE_KEY)
        toast.success(created.message)
        router.replace(created.redirectTo)
        router.refresh()
        return
      }

      const result = await authClient.signIn.email({ email: normalizedEmail, password })

      if (result.error) {
        setError(authMessage(result.error.code))
        return
      }

      // A two-factor challenge leaves no session behind, so the getSession
      // below would report a failure that is really a pending step. Send the
      // person to the challenge and come back to this invitation after it.
      if (needsTwoFactor(result.data)) {
        router.push(twoFactorHref(`/invite?token=${encodeURIComponent(token)}`))
        return
      }

      const session = await authClient.getSession()
      const user = session.data?.user
      if (!user) {
        setError('تم حفظ الحساب، لكن تعذر بدء الجلسة. سجّل الدخول للمتابعة.')
        setMode('sign-in')
        return
      }
      setCurrentUser({ name: user.name, email: user.email })
      await accept(token)
    })
  }

  function signOut() {
    startTransition(async () => {
      await authClient.signOut()
      setCurrentUser(null)
      setError(null)
    })
  }

  if (loading) {
    return (
      <div className="invite-loading" role="status">
        <span className="visually-hidden">جارٍ التحقق من الدعوة</span>
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="invite-terminal">
        <AlertCircle size={28} aria-hidden="true" />
        <div>
          <h1>تعذر فتح الدعوة</h1>
          <p>{error}</p>
        </div>
        <Link href="/contact" className="btn btn--primary">
          تواصل مع مُجاوِب
        </Link>
      </div>
    )
  }

  return (
    <div className="invite-acceptance">
      <div className="auth__head">
        <span className="invite-acceptance__icon" aria-hidden="true">
          <MailCheck size={21} />
        </span>
        <h1>انضم إلى {preview.workspaceName}</h1>
        <p>راجع الدعوة، ثم استخدم البريد الذي أُرسلت إليه لإكمال الربط.</p>
      </div>

      <dl className="invite-facts">
        <div>
          <dt>مساحة العمل</dt>
          <dd>{preview.workspaceName}</dd>
        </div>
        <div>
          <dt>الصلاحية</dt>
          <dd>{preview.roleLabel}</dd>
        </div>
        <div>
          <dt>البريد المدعو</dt>
          <dd className="mono" dir="ltr">
            {preview.maskedEmail}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {currentUser ? (
        <div className="invite-session">
          <div>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              مسجّل باسم <strong>{currentUser.name}</strong>
              <small className="mono" dir="ltr">
                {currentUser.email}
              </small>
            </span>
          </div>
          <Button
            variant="quiet"
            leading={<LogOut size={15} />}
            onClick={signOut}
            disabled={pending}
          >
            حساب آخر
          </Button>
          <Button
            variant="primary"
            size="lg"
            block
            onClick={onAccept}
            disabled={pending}
            trailing={
              pending ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <ArrowLeft size={17} className="arrow" />
              )
            }
          >
            {pending ? 'جارٍ ربط الحساب…' : 'قبول الدعوة والدخول'}
          </Button>
        </div>
      ) : (
        <>
          <fieldset className="invite-mode">
            <legend className="visually-hidden">طريقة المتابعة</legend>
            <button
              type="button"
              aria-pressed={mode === 'sign-in'}
              onClick={() => setMode('sign-in')}
            >
              لدي حساب
            </button>
            {!preview.accountExists ? (
              <button
                type="button"
                aria-pressed={mode === 'sign-up'}
                onClick={() => setMode('sign-up')}
              >
                إنشاء حساب الدعوة
              </button>
            ) : (
              <span className="invite-mode__locked">الحساب موجود</span>
            )}
          </fieldset>
          <form className="auth__form" onSubmit={onAuth}>
            {mode === 'sign-up' ? (
              <div className="field">
                <label htmlFor="invite-name">الاسم</label>
                <input
                  id="invite-name"
                  className="input"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="invite-email">البريد الإلكتروني</label>
              <input
                id="invite-email"
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
            <div className="field">
              <label htmlFor="invite-password">كلمة المرور</label>
              <PasswordField
                id="invite-password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === 'sign-up' ? (
                <span className="field__hint">استخدم 10 أحرف على الأقل.</span>
              ) : null}
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={pending}
              trailing={
                pending ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <ArrowLeft size={17} className="arrow" />
                )
              }
            >
              {pending
                ? 'جارٍ المتابعة…'
                : mode === 'sign-up'
                  ? 'أنشئ الحساب واقبل الدعوة'
                  : 'سجّل الدخول واقبل الدعوة'}
            </Button>
          </form>
          <p className="auth__foot invite-auth-foot">
            تستخدم تسجيل الدخول عبر Google؟{' '}
            <Link href="/sign-in?next=/invite">افتح صفحة تسجيل الدخول</Link>
          </p>
        </>
      )}
    </div>
  )
}
