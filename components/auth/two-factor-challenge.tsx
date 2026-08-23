'use client'

import { AlertCircle, ArrowLeft, KeyRound, LifeBuoy, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { safeInternalPath } from '@/lib/navigation'

type Failure = { message: string; hint?: string; dead?: boolean }

/**
 * Every failure below used to read "الرمز غير صحيح", including the ones a
 * correct code cannot fix — an expired challenge, a spent attempt budget, a
 * locked account. Someone holding the right code then retries until the lock
 * bites, which is exactly how an operator loses access to their own console.
 * `dead: true` marks the states where retrying here is pointless, so the form
 * is replaced by the way out instead of another empty box.
 */
function readFailure(status: number | undefined, code: string | undefined): Failure {
  switch (code) {
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return {
        message: 'أوقفنا المحاولات مؤقتًا بعد عدة رموز خاطئة.',
        hint: 'انتظر ربع ساعة ثم حاول مرة أخرى، أو استخدم رمزًا احتياطيًا الآن.',
        dead: true,
      }
    case 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE':
      return {
        message: 'استهلكت محاولات هذه الجلسة.',
        hint: 'ارجع لصفحة الدخول وسجّل الدخول من جديد لتبدأ محاولة جديدة.',
        dead: true,
      }
    case 'INVALID_TWO_FACTOR_COOKIE':
      return {
        message: 'انتهت صلاحية هذه الصفحة.',
        hint: 'صلاحية التحقق عشر دقائق من لحظة إدخال كلمة المرور. سجّل الدخول مرة أخرى.',
        dead: true,
      }
    case 'TOTP_NOT_ENABLED':
      return {
        message: 'لا يوجد تطبيق مصادقة مرتبط بهذا الحساب.',
        hint: 'إن كنت قد بدأت الإعداد ولم تكمله، تواصل مع مسؤول مساحة العمل لإعادة تعيينه.',
        dead: true,
      }
    case 'INVALID_BACKUP_CODE':
      return {
        message: 'هذا الرمز الاحتياطي غير صحيح أو استُخدم من قبل.',
        hint: 'كل رمز يعمل مرة واحدة فقط، ويُكتب كما ظهر بالضبط مع الشرطة والحروف الكبيرة.',
      }
    default:
      break
  }

  // Better Auth caps `/two-factor/*` at three requests every ten seconds, so a
  // fast retry returns 429 with no code — not a wrong code at all.
  if (status === 429) {
    return {
      message: 'محاولات كثيرة في وقت قصير.',
      hint: 'انتظر بضع ثوانٍ ثم أدخل الرمز الظاهر حاليًا في التطبيق.',
    }
  }

  if (status === 500) {
    return {
      message: 'تعذر التحقق من الرمز على الخادم.',
      hint: 'المشكلة ليست في الرمز. تواصل مع فريق مُجاوِب لإعادة تعيين التحقق بخطوتين.',
      dead: true,
    }
  }

  return {
    message: 'الرمز غير صحيح.',
    hint: 'الرمز يتغيّر كل 30 ثانية — أدخل الرمز الظاهر الآن. وإن تكرر الرفض، تأكد أن وقت الجهاز مضبوط تلقائيًا.',
  }
}

export function TwoFactorChallenge() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [method, setMethod] = useState<'totp' | 'backup'>('totp')
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const requested = searchParams.get('next') ?? searchParams.get('callbackURL')
  const signInHref = requested
    ? `/sign-in?next=${encodeURIComponent(safeInternalPath(requested, '/console'))}`
    : '/sign-in'

  async function verify(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setFailure(null)

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
      setFailure(readFailure(result.error.status, result.error.code))
      setCode('')
      setPending(false)
      return
    }

    router.replace(safeInternalPath(requested, '/auth/continue'))
    router.refresh()
  }

  function switchMethod(next: 'totp' | 'backup') {
    setMethod(next)
    setCode('')
    setFailure(null)
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
        <button type="button" aria-pressed={method === 'totp'} onClick={() => switchMethod('totp')}>
          تطبيق المصادقة
        </button>
        <button
          type="button"
          aria-pressed={method === 'backup'}
          onClick={() => switchMethod('backup')}
        >
          رمز احتياطي
        </button>
      </fieldset>

      {failure ? (
        <div className="auth__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" style={{ flex: 'none', marginBlockStart: 2 }} />
          <span>
            {failure.message}
            {failure.hint ? <small>{failure.hint}</small> : null}
          </span>
        </div>
      ) : null}

      {failure?.dead ? (
        <div className="auth__recovery">
          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => router.push(signInHref)}
            leading={<ArrowLeft size={17} className="arrow" aria-hidden="true" />}
          >
            العودة لتسجيل الدخول
          </Button>
          {method === 'totp' ? (
            <button type="button" className="text-action" onClick={() => switchMethod('backup')}>
              <KeyRound size={15} aria-hidden="true" />
              استخدام رمز احتياطي بدلًا من ذلك
            </button>
          ) : null}
        </div>
      ) : (
        <form className="auth__form" onSubmit={verify}>
          <div className="field">
            <label htmlFor="two-factor-code">
              {method === 'totp' ? 'رمز التحقق المكوّن من 6 أرقام' : 'الرمز الاحتياطي'}
            </label>
            <input
              id="two-factor-code"
              className="input mono security-code-input"
              inputMode={method === 'totp' ? 'numeric' : 'text'}
              // The stored codes are mixed case with a dash; correcting either
              // silently would turn a valid code into a rejected one.
              autoCapitalize={method === 'totp' ? 'off' : 'characters'}
              autoCorrect="off"
              spellCheck={false}
              autoComplete="one-time-code"
              // biome-ignore lint/a11y/noAutofocus: the only input on a single-purpose page
              autoFocus
              minLength={method === 'totp' ? 6 : 8}
              maxLength={method === 'totp' ? 6 : 32}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={method === 'totp' ? '000000' : 'abcde-12345'}
            />
            {method === 'backup' ? (
              <p className="field__note">
                الرموز الاحتياطية ظهرت مرة واحدة عند تفعيل التحقق. اكتب الرمز كما هو، بالشرطة.
              </p>
            ) : null}
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
            aria-busy={pending}
            leading={pending ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
          >
            {pending ? 'جارٍ التحقق…' : 'إكمال الدخول'}
          </Button>
        </form>
      )}

      <div className="auth__escape">
        <Link href={signInHref}>
          <ArrowLeft size={14} className="arrow" aria-hidden="true" />
          العودة لتسجيل الدخول
        </Link>
        <Link href="/contact">
          <LifeBuoy size={14} aria-hidden="true" />
          فقدت جهازك ورموزك الاحتياطية؟
        </Link>
      </div>
    </div>
  )
}
