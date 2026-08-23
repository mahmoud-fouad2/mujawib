'use client'

import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { type FormEvent, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'
import { createSalesInquiry } from '@/server/actions/contact'

export function ContactForm({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Held across the await: React clears `currentTarget` once the handler
    // returns, so reading it inside the transition threw on every success.
    const element = event.currentTarget
    const form = new FormData(element)
    startTransition(async () => {
      const response = await createSalesInquiry({
        name: String(form.get('name') ?? ''),
        company: String(form.get('company') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        need: String(form.get('need') ?? ''),
        monthlyCalls: String(form.get('monthlyCalls') ?? 'unknown') as
          | 'under_500'
          | '500_2000'
          | '2000_10000'
          | 'over_10000'
          | 'unknown',
        locale,
        consent: form.get('consent') === 'on',
        website: String(form.get('website') ?? ''),
      })
      setResult({ ok: response.ok, message: response.ok ? response.message : response.error })
      if (response.ok) element.reset()
    })
  }

  if (result?.ok) {
    return (
      <div className="contact-success" role="status">
        <Check size={22} aria-hidden="true" />
        <div>
          <h2>{ar ? 'أصبح الطلب لدى الفريق.' : 'Your request is with the team.'}</h2>
          <p>{result.message}</p>
        </div>
      </div>
    )
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-form__head">
        <span>{ar ? 'ابدأ بسيناريو واحد' : 'Start with one workflow'}</span>
        <h2>{ar ? 'أخبرنا أين تضيع المكالمات اليوم.' : 'Tell us where calls break today.'}</h2>
        <p>
          {ar
            ? 'نعود لك بخطة تشغيل محددة وتقدير للحجم، لا بعرض عام.'
            : 'We will return with a scoped operating plan and volume estimate, not a generic deck.'}
        </p>
      </div>
      {result && !result.ok ? (
        <p className="auth__error" role="alert">
          {result.message}
        </p>
      ) : null}
      <div className="contact-form__fields">
        <div className="field">
          <label htmlFor={`${locale}-contact-name`}>{ar ? 'الاسم' : 'Name'}</label>
          <input
            id={`${locale}-contact-name`}
            name="name"
            className="input"
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-company`}>{ar ? 'الشركة' : 'Company'}</label>
          <input
            id={`${locale}-contact-company`}
            name="company"
            className="input"
            autoComplete="organization"
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-email`}>{ar ? 'بريد العمل' : 'Work email'}</label>
          <input
            id={`${locale}-contact-email`}
            name="email"
            className="input mono"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="name@company.com"
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-phone`}>{ar ? 'الهاتف' : 'Phone'}</label>
          <input
            id={`${locale}-contact-phone`}
            name="phone"
            className="input mono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+966 5X XXX XXXX"
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-volume`}>
            {ar ? 'المكالمات شهريًا' : 'Monthly calls'}
          </label>
          <select
            id={`${locale}-contact-volume`}
            name="monthlyCalls"
            className="input"
            defaultValue="unknown"
          >
            <option value="unknown">{ar ? 'غير متأكد' : 'Not sure'}</option>
            <option value="under_500">{ar ? 'أقل من 500' : 'Under 500'}</option>
            <option value="500_2000">500–2,000</option>
            <option value="2000_10000">2,000–10,000</option>
            <option value="over_10000">{ar ? 'أكثر من 10,000' : 'Over 10,000'}</option>
          </select>
        </div>
        <div className="field contact-form__need">
          <label htmlFor={`${locale}-contact-need`}>
            {ar ? 'أول نتيجة تريد تشغيلها' : 'First outcome to automate'}
          </label>
          <textarea
            id={`${locale}-contact-need`}
            name="need"
            className="input"
            required
            minLength={12}
            maxLength={1200}
            rows={4}
            placeholder={
              ar
                ? 'مثال: حجز الموعد وتأكيده عبر واتساب'
                : 'Example: book and confirm appointments over WhatsApp'
            }
          />
        </div>
        <div className="contact-form__honeypot" aria-hidden="true">
          <label htmlFor={`${locale}-contact-website`}>Website</label>
          <input id={`${locale}-contact-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>
      <label className="check-row">
        <input name="consent" type="checkbox" required />
        {ar
          ? 'أوافق على تواصل فريق مُجاوِب معي بخصوص هذا الطلب.'
          : 'I agree that the Mujawib team may contact me about this request.'}
      </label>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending}
        trailing={
          pending ? (
            <Loader2 size={17} className="spin" />
          ) : ar ? (
            <ArrowLeft size={17} />
          ) : (
            <ArrowRight size={17} />
          )
        }
      >
        {pending
          ? ar
            ? 'جارٍ الإرسال…'
            : 'Sending…'
          : ar
            ? 'اطلب خطة تشغيل'
            : 'Request an operating plan'}
      </Button>
    </form>
  )
}
