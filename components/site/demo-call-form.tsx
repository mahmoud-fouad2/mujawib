'use client'

import { Check, PhoneCall } from 'lucide-react'
import Script from 'next/script'
import { type FormEvent, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { DEMO_CODE_LENGTH, DEMO_COUNTRIES } from '@/lib/demo-call'
import type { Locale } from '@/lib/i18n'
import { requestDemoCall, resendDemoCode, verifyDemoCall } from '@/server/actions/demo-call'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

/** Never throws — a blocked or missing widget degrades to an unverified submit. */
async function recaptchaToken(siteKey: string | undefined): Promise<string | undefined> {
  if (!siteKey) return undefined
  const start = Date.now()
  while (!window.grecaptcha && Date.now() - start < 4_000) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const widget = window.grecaptcha
  if (!widget) return undefined
  return new Promise((resolve) => {
    widget.ready(() => {
      widget.execute(siteKey, { action: 'demo_call' }).then(resolve, () => resolve(undefined))
    })
  })
}

/**
 * "Let the assistant call you" — the strongest thing this product can show a
 * visitor, and the most abusable form on the site.
 *
 * Two steps, and the second is the point: a code goes to the number, and the
 * call only happens once somebody reads it back. That is what separates a demo
 * from a way to make a stranger's phone ring, and it is why this asks for a
 * code rather than just saying thank you.
 *
 * Where the platform cannot send SMS, step two never appears and the request
 * becomes a lead an operator handles by hand. The form says which of the two
 * happened rather than implying a call either way.
 */

export type DemoPersonaOption = {
  key: string
  name: string
  dialectLabel: string
  gender: 'male' | 'female'
}

export function DemoCallForm({
  locale,
  personas,
  recaptchaSiteKey,
}: {
  locale: Locale
  personas: DemoPersonaOption[]
  recaptchaSiteKey?: string | undefined
}) {
  const ar = locale === 'ar'
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [country, setCountry] = useState('SA')
  const [persona, setPersona] = useState(personas[0]?.key ?? '')
  /** Set once a code has been sent; null means we are still on step one. */
  const [awaiting, setAwaiting] = useState<{ requestId: string; phone: string } | null>(null)
  const [code, setCode] = useState('')
  const [done, setDone] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const typedPhone = String(form.get('phone') ?? '')
    startTransition(async () => {
      const response = await requestDemoCall({
        countryCode: country,
        phone: typedPhone,
        name: String(form.get('name') ?? '') || undefined,
        businessName: String(form.get('businessName') ?? '') || undefined,
        ...(persona ? { personaKey: persona } : {}),
        locale: ar ? 'ar' : 'en',
        consent: form.get('consent') === 'on',
        website: String(form.get('website') ?? ''),
        recaptchaToken: await recaptchaToken(recaptchaSiteKey),
      })
      setResult({ ok: response.ok, message: response.ok ? response.message : response.error })
      if (!response.ok) return
      if (response.data?.needsVerification) {
        setAwaiting({ requestId: response.data.requestId, phone: typedPhone })
      } else {
        // No SMS on this deployment: the request is a lead, and the message
        // already says an operator will call.
        setDone(response.message)
      }
      element.reset()
    })
  }

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!awaiting) return
    startTransition(async () => {
      const response = await verifyDemoCall({
        requestId: awaiting.requestId,
        code,
        locale: ar ? 'ar' : 'en',
      })
      setResult({ ok: response.ok, message: response.ok ? response.message : response.error })
      if (response.ok) {
        setDone(response.message)
        setAwaiting(null)
        setCode('')
      }
    })
  }

  const dial = DEMO_COUNTRIES.find((c) => c.code === country)?.dial ?? '966'

  if (done) {
    return (
      <div className="contact-success" role="status">
        <Check size={28} style={{ color: 'var(--good)' }} aria-hidden="true" />
        <div>
          <h2>{ar ? 'تم' : 'Done'}</h2>
          <p>{done}</p>
        </div>
      </div>
    )
  }

  if (awaiting) {
    return (
      <form className="demo-call" onSubmit={confirm}>
        <div className="demo-call__head">
          <span className="hero__eyebrow">
            <PhoneCall size={14} aria-hidden="true" />
            {ar ? 'خطوة أخيرة' : 'One last step'}
          </span>
          <h2>{ar ? 'أدخل الرمز' : 'Enter the code'}</h2>
          <p>
            {ar
              ? `أرسلنا رمزًا من ${DEMO_CODE_LENGTH} أرقام إلى ${awaiting.phone}. هذا يؤكد أن الرقم رقمك — ولا نتصل بأي رقم قبل تأكيده.`
              : `We sent a ${DEMO_CODE_LENGTH}-digit code to ${awaiting.phone}. This confirms the number is yours; we never call a number before it is confirmed.`}
          </p>
        </div>

        {result && !result.ok ? (
          <p className="auth__error" role="alert">
            {result.message}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor={`${locale}-demo-code`}>{ar ? 'رمز التحقق' : 'Verification code'}</label>
          <input
            id={`${locale}-demo-code`}
            className="input demo-call__code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={DEMO_CODE_LENGTH}
            dir="ltr"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={pending || code.length < 4}
        >
          {pending
            ? ar
              ? 'جارٍ التأكيد…'
              : 'Confirming…'
            : ar
              ? 'أكّد واتصل بي'
              : 'Confirm and call me'}
        </Button>

        <button
          type="button"
          className="demo-call__resend"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const response = await resendDemoCode({
                requestId: awaiting.requestId,
                code: '0000',
                locale: ar ? 'ar' : 'en',
              })
              setResult({
                ok: response.ok,
                message: response.ok ? response.message : response.error,
              })
            })
          }
        >
          {ar ? 'لم يصلني الرمز — أرسله مرة أخرى' : 'Did not get it — send again'}
        </button>
      </form>
    )
  }

  return (
    <form className="demo-call" onSubmit={submit}>
      {recaptchaSiteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`}
          strategy="afterInteractive"
        />
      ) : null}
      <div className="demo-call__head">
        <span className="hero__eyebrow">
          <PhoneCall size={14} aria-hidden="true" />
          {ar ? 'جرّبه على هاتفك' : 'Hear it on your phone'}
        </span>
        <h2>{ar ? 'خلّي مُجاوِب يتصل بك' : 'Let Mujawib call you'}</h2>
        <p>
          {ar
            ? 'اختر اللهجة والصوت، واترك رقمك — ستصلك مكالمة من الموظف الصوتي نفسه الذي سيرد على عملائك.'
            : 'Pick a voice, leave your number, and the same assistant that answers your customers will call you.'}
        </p>
      </div>

      {result && !result.ok ? (
        <p className="auth__error" role="alert">
          {result.message}
        </p>
      ) : null}

      {personas.length > 0 ? (
        <fieldset className="field">
          <legend>{ar ? 'الصوت واللهجة' : 'Voice and dialect'}</legend>
          <div className="day-toggles">
            {personas.map((option) => (
              <button
                key={option.key}
                type="button"
                className="day-toggle"
                aria-pressed={option.key === persona}
                onClick={() => setPersona(option.key)}
              >
                {option.name} · {option.dialectLabel}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="field">
        <label htmlFor={`${locale}-demo-country`}>{ar ? 'الدولة' : 'Country'}</label>
        <select
          id={`${locale}-demo-country`}
          className="input"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {DEMO_COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {ar ? option.labelAr : option.labelEn} (+{option.dial})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${locale}-demo-phone`}>{ar ? 'رقم هاتفك' : 'Your phone number'}</label>
        <input
          id={`${locale}-demo-phone`}
          name="phone"
          className="input"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          required
          placeholder={`+${dial} 5X XXX XXXX`}
        />
      </div>

      <div className="field">
        <label htmlFor={`${locale}-demo-business`}>
          {ar ? 'اسم نشاطك (اختياري)' : 'Your business (optional)'}
        </label>
        <input
          id={`${locale}-demo-business`}
          name="businessName"
          className="input"
          autoComplete="organization"
          placeholder={ar ? 'عيادة النور' : 'Acme Clinic'}
        />
      </div>

      <div className="field">
        <label htmlFor={`${locale}-demo-name`}>
          {ar ? 'اسمك (اختياري)' : 'Your name (optional)'}
        </label>
        <input
          id={`${locale}-demo-name`}
          name="name"
          className="input"
          autoComplete="name"
          placeholder={ar ? 'أحمد' : 'Alex'}
        />
      </div>

      {/* Honeypot. Hidden from people, irresistible to form-fillers. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inlineSize: 1,
          blockSize: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      <div className="field field--inline">
        <input id={`${locale}-demo-consent`} name="consent" type="checkbox" required />
        <label htmlFor={`${locale}-demo-consent`}>
          {ar
            ? 'أؤكد أن هذا رقمي وأوافق على استقبال مكالمة تجريبية واحدة.'
            : 'I confirm this is my own number and agree to receive one demo call.'}
        </label>
      </div>

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'اتصلوا بي' : 'Call me'}
      </Button>

      {/*
        Says what actually happens. A form that implies an instant call and
        then produces one during business hours is a worse first impression
        than one that was honest about it.
      */}
      <p className="demo-call__note">
        {ar
          ? 'نرسل رمزًا لتأكيد أن الرقم رقمك. مكالمة واحدة لكل رقم في اليوم، خلال ساعات العمل. لا نستخدم رقمك لأي غرض آخر ولا نشاركه.'
          : 'We text a code to confirm the number is yours. One call per number per day, during business hours. Your number is never used for anything else and never shared.'}
      </p>
    </form>
  )
}
