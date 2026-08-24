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
  const [selectedVolume, setSelectedVolume] = useState<string>('500_2000')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    startTransition(async () => {
      const response = await createSalesInquiry({
        name: String(form.get('name') ?? ''),
        company: String(form.get('company') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        need: String(form.get('need') ?? ''),
        monthlyCalls: (selectedVolume || String(form.get('monthlyCalls') ?? 'unknown')) as
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
        <Check size={28} style={{ color: 'var(--good)' }} aria-hidden="true" />
        <div>
          <h2>{ar ? 'تم استلام طلبك بنجاح!' : 'Your request has been received!'}</h2>
          <p>{result.message}</p>
          <span className="pill pill--good" style={{ marginBlockStart: 'var(--s-3)' }}>
            {ar
              ? 'سيتواصل معك مستشارنا الصوتي قريباً'
              : 'Our voice consultant will reach out shortly'}
          </span>
        </div>
      </div>
    )
  }

  const VOLUME_OPTIONS = [
    { value: 'under_500', label: ar ? 'أقل من 500 مكالمة' : 'Under 500 calls' },
    { value: '500_2000', label: ar ? '500 إلى 2,000 مكالمة' : '500–2,000 calls' },
    { value: '2000_10000', label: ar ? '2,000 إلى 10,000 مكالمة' : '2,000–10,000 calls' },
    { value: 'over_10000', label: ar ? 'أكثر من 10,000 مكالمة' : 'Over 10,000 calls' },
  ]

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-form__head">
        <span>{ar ? 'استشارة وتشخيص مجاني' : 'Free Discovery & Scoping'}</span>
        <h2>{ar ? 'أين تضيع مكالمات عملائك اليوم؟' : 'Where are your calls dropping today?'}</h2>
        <p>
          {ar
            ? 'نصمم لك خطة تشغيلية وسيناريو صوتي مخصص مع تجربة حية على رقم هاتفك قبل اتخاذ أي قرار.'
            : 'We scope a dedicated voice workflow with a live demo on your phone number before any commitment.'}
        </p>
        <div
          style={{
            display: 'grid',
            gap: 'var(--s-2)',
            marginBlockStart: 'var(--s-4)',
            padding: 'var(--s-3)',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            fontSize: 'var(--step--1)',
          }}
        >
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span style={{ color: 'var(--good)' }}>✓</span>
            <span>
              {ar ? 'استجابة سريعة خلال 4 ساعات عمل' : 'Fast response within 4 working hours'}
            </span>
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span style={{ color: 'var(--good)' }}>✓</span>
            <span>{ar ? 'جلسة تجربة صوتية حية مخصصة' : 'Custom live voice demo session'}</span>
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span style={{ color: 'var(--good)' }}>✓</span>
            <span>{ar ? 'سرية وأمان تام للبيانات' : 'Strict data privacy & confidentiality'}</span>
          </div>
        </div>
      </div>

      {result && !result.ok ? (
        <p className="auth__error" role="alert">
          {result.message}
        </p>
      ) : null}

      <div className="contact-form__fields">
        <div className="field">
          <label htmlFor={`${locale}-contact-name`}>{ar ? 'الاسم الكريم' : 'Full name'}</label>
          <input
            id={`${locale}-contact-name`}
            name="name"
            className="input"
            autoComplete="name"
            required
            minLength={2}
            placeholder={ar ? 'أحمد الغامدي' : 'John Doe'}
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-company`}>
            {ar ? 'اسم المنشأة / العيادة' : 'Company / Clinic name'}
          </label>
          <input
            id={`${locale}-contact-company`}
            name="company"
            className="input"
            autoComplete="organization"
            required
            minLength={2}
            placeholder={ar ? 'مجمع النخبة الطبي' : 'Acme Healthcare'}
          />
        </div>
        <div className="field">
          <label htmlFor={`${locale}-contact-email`}>
            {ar ? 'البريد الإلكتروني' : 'Work email'}
          </label>
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
          <label htmlFor={`${locale}-contact-phone`}>
            {ar ? 'رقم الجوال للتواصل' : 'Phone number'}
          </label>
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

        <div className="field contact-form__need" style={{ marginBlockEnd: 'var(--s-2)' }}>
          <label>{ar ? 'حجم المكالمات الشهرية التقريبي' : 'Estimated monthly calls'}</label>
          <div
            className="row"
            style={{ gap: 'var(--s-2)', flexWrap: 'wrap', marginBlockStart: 'var(--s-1)' }}
          >
            {VOLUME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`filter-chip${selectedVolume === opt.value ? ' is-active' : ''}`}
                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                onClick={() => setSelectedVolume(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="monthlyCalls" value={selectedVolume} />
        </div>

        <div className="field contact-form__need">
          <label htmlFor={`${locale}-contact-need`}>
            {ar ? 'أول نتيجة أو سيناريو تريد تشغيله' : 'First outcome to automate'}
          </label>
          <textarea
            id={`${locale}-contact-need`}
            name="need"
            className="input"
            required
            minLength={8}
            maxLength={1200}
            rows={4}
            placeholder={
              ar
                ? 'مثال: حجز وتعديل مواعيد المرضى في عيادة الأسنان والرد على أسعار الكشف وإرسال الموقع عبر واتساب.'
                : 'Example: automate patient appointment booking for clinic, answer pricing inquiries, and send WhatsApp location confirmations.'
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
          ? 'أوافق على تواصل مستشار مُجاوِب معي بخصوص هذا الطلب.'
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
            ? 'اطلب خطة التشغيل والتجربة الحية'
            : 'Request operating plan & live demo'}
      </Button>
    </form>
  )
}
