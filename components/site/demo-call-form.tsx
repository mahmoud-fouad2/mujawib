'use client'

import { Check, PhoneCall } from 'lucide-react'
import { type FormEvent, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { DEMO_COUNTRIES } from '@/lib/demo-call'
import type { Locale } from '@/lib/i18n'
import { requestDemoCall } from '@/server/actions/demo-call'

/**
 * "Let the assistant call you" — the strongest thing this product can show a
 * visitor, and the most abusable form on the site.
 *
 * What it promises is exactly what happens: the request reaches an operator,
 * who places the call. It does not say "calling you now" and then not call,
 * and it does not dial the moment a stranger types somebody else's number.
 *
 * The consent checkbox is not decoration. It is the record that the person
 * submitting asserted the number is theirs, and it is stored with the row.
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
}: {
  locale: Locale
  personas: DemoPersonaOption[]
}) {
  const ar = locale === 'ar'
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [country, setCountry] = useState('SA')
  const [persona, setPersona] = useState(personas[0]?.key ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    startTransition(async () => {
      const response = await requestDemoCall({
        countryCode: country,
        phone: String(form.get('phone') ?? ''),
        name: String(form.get('name') ?? '') || undefined,
        businessName: String(form.get('businessName') ?? '') || undefined,
        ...(persona ? { personaKey: persona } : {}),
        locale: ar ? 'ar' : 'en',
        consent: form.get('consent') === 'on',
        website: String(form.get('website') ?? ''),
      })
      setResult({ ok: response.ok, message: response.ok ? response.message : response.error })
      if (response.ok) element.reset()
    })
  }

  const dial = DEMO_COUNTRIES.find((c) => c.code === country)?.dial ?? '966'

  if (result?.ok) {
    return (
      <div className="contact-success" role="status">
        <Check size={28} style={{ color: 'var(--good)' }} aria-hidden="true" />
        <div>
          <h2>{ar ? 'وصل طلبك' : 'Request received'}</h2>
          <p>{result.message}</p>
        </div>
      </div>
    )
  }

  return (
    <form className="demo-call" onSubmit={submit}>
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
          ? 'مكالمة واحدة لكل رقم في اليوم، خلال ساعات العمل. لا نستخدم رقمك لأي غرض آخر ولا نشاركه.'
          : 'One call per number per day, during business hours. Your number is not used for anything else and is never shared.'}
      </p>
    </form>
  )
}
