'use client'

import { Check, Clipboard, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import Image from 'next/image'
import { toDataURL } from 'qrcode'
import { type FormEvent, useEffect, useState } from 'react'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { authClient } from '@/lib/auth-client'

type Setup = { uri: string; backupCodes: string[]; qr: string }

export function SecuritySettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const toast = useToast()
  const [enabled, setEnabled] = useState(initiallyEnabled)
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [pending, setPending] = useState<'enable' | 'verify' | 'disable' | null>(null)

  useEffect(() => {
    return () => {
      setSetup(null)
      setVerificationCode('')
    }
  }, [])

  async function enable(event: FormEvent) {
    event.preventDefault()
    setPending('enable')
    const result = await authClient.twoFactor.enable({
      password,
      method: 'totp',
      issuer: 'MUJAWIB',
    })
    if (result.error || !result.data || !('totpURI' in result.data)) {
      toast.error(
        result.error?.status === 429
          ? 'محاولات كثيرة في وقت قصير. انتظر بضع ثوانٍ ثم حاول مرة أخرى.'
          : 'تعذر تفعيل التحقق. تأكد من كلمة المرور وحاول مرة أخرى.',
      )
      setPending(null)
      return
    }

    const qr = await toDataURL(result.data.totpURI, {
      margin: 1,
      width: 240,
      color: { dark: '#111318', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
    setSetup({ uri: result.data.totpURI, backupCodes: result.data.backupCodes, qr })
    setPassword('')
    setPending(null)
  }

  async function verifySetup(event: FormEvent) {
    event.preventDefault()
    setPending('verify')
    const result = await authClient.twoFactor.verifyTotp({
      code: verificationCode.trim().replaceAll(' ', ''),
      trustDevice: true,
    })
    if (result.error) {
      // Better Auth allows three requests per ten seconds here, so a quick
      // second attempt fails with 429 rather than a wrong code.
      toast.error(
        result.error.status === 429
          ? 'محاولات كثيرة في وقت قصير. انتظر بضع ثوانٍ ثم أدخل الرمز الظاهر حاليًا.'
          : 'الرمز غير صحيح. الرمز يتغيّر كل 30 ثانية — أدخل الظاهر الآن، وتأكد أن وقت الجهاز يُضبط تلقائيًا.',
      )
      setPending(null)
      return
    }
    setEnabled(true)
    setVerificationCode('')
    setPending(null)
    toast.success('أصبح التحقق بخطوتين فعالًا.')
  }

  async function disable(event: FormEvent) {
    event.preventDefault()
    setPending('disable')
    const result = await authClient.twoFactor.disable({ password })
    if (result.error) {
      toast.error('تعذر تعطيل التحقق. تأكد من كلمة المرور.')
      setPending(null)
      return
    }
    setEnabled(false)
    setSetup(null)
    setPassword('')
    setPending(null)
    toast.success('تم تعطيل التحقق بخطوتين.')
  }

  return (
    <div className="security-settings">
      <section className="security-row">
        <div className="security-row__icon" data-enabled={enabled}>
          {enabled ? <ShieldCheck size={21} /> : <ShieldOff size={21} />}
        </div>
        <div className="security-row__body">
          <div className="security-row__title">
            <h2>تطبيق المصادقة</h2>
            <span className="pill" data-tone={enabled ? 'good' : 'neutral'}>
              {enabled ? 'مفعّل' : 'غير مفعّل'}
            </span>
          </div>
          <p>يضيف رمزًا مؤقتًا بعد كلمة المرور، ويمنع استخدام الحساب حتى عند انكشاف كلمة المرور.</p>

          {!enabled && !setup ? (
            <form className="security-inline-form" onSubmit={enable}>
              <div className="field">
                <label htmlFor="enable-password">كلمة المرور الحالية</label>
                <PasswordField
                  id="enable-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  minLength={10}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={pending !== null}
                leading={
                  pending === 'enable' ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <KeyRound size={16} />
                  )
                }
              >
                بدء الإعداد
              </Button>
            </form>
          ) : null}

          {setup ? (
            <div className="security-setup">
              <div className="security-setup__scan">
                <Image
                  src={setup.qr}
                  alt="رمز QR لإعداد تطبيق المصادقة"
                  width={240}
                  height={240}
                  unoptimized
                />
                <div>
                  <h3>1. امسح الرمز</h3>
                  <p>استخدم 1Password أو Google Authenticator أو أي تطبيق TOTP.</p>
                  <button
                    type="button"
                    className="text-action"
                    onClick={async () => {
                      await navigator.clipboard.writeText(setup.uri)
                      toast.success('نُسخ رابط الإعداد.')
                    }}
                  >
                    <Clipboard size={15} />
                    نسخ رابط الإعداد
                  </button>
                </div>
              </div>

              <div className="security-backup">
                <h3>2. خزّن الرموز الاحتياطية</h3>
                <p>
                  كل رمز يُستخدم مرة واحدة، ولن نعرض هذه المجموعة مرة أخرى. إذا فقدت هاتفك فهذه
                  الرموز هي طريقك الوحيد للدخول — احفظها خارج الجهاز قبل المتابعة.
                </p>
                <div className="security-backup__codes" dir="ltr">
                  {setup.backupCodes.map((code) => (
                    <code key={code}>{code}</code>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-action"
                  onClick={async () => {
                    await navigator.clipboard.writeText(setup.backupCodes.join('\n'))
                    toast.success('نُسخت الرموز الاحتياطية.')
                  }}
                >
                  <Clipboard size={15} />
                  نسخ الرموز الاحتياطية
                </button>
              </div>

              <form className="security-inline-form" onSubmit={verifySetup}>
                <div className="field">
                  <label htmlFor="setup-code">3. أدخل أول رمز للتحقق</label>
                  <input
                    id="setup-code"
                    className="input mono security-code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    minLength={6}
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={pending !== null}
                  leading={
                    pending === 'verify' ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Check size={16} />
                    )
                  }
                >
                  تأكيد التفعيل
                </Button>
              </form>
            </div>
          ) : null}

          {enabled && !setup ? (
            <form className="security-inline-form" onSubmit={disable}>
              <div className="field">
                <label htmlFor="disable-password">كلمة المرور الحالية</label>
                <PasswordField
                  id="disable-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  minLength={10}
                  required
                />
              </div>
              <Button type="submit" variant="danger" disabled={pending !== null}>
                {pending === 'disable' ? 'جارٍ التعطيل…' : 'تعطيل التحقق'}
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  )
}
