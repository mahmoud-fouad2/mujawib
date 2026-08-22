import { Activity, Radio, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Logo } from '@/components/brand/logo'
import { CallRecord } from '@/components/site/call-record'
import { clock } from '@/lib/format'
import { safeInternalPath } from '@/lib/navigation'
import { buildRecordItems } from '@/lib/record'
import { GOOGLE_ENABLED } from '@/server/auth'
import { getHeroCall } from '@/server/data/marketing'
import { isDatabaseUnavailable } from '@/server/db'

export const metadata: Metadata = { title: 'تسجيل الدخول' }
export const dynamic = 'force-dynamic'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const returnTo = safeInternalPath((await searchParams).next, '/auth/continue')
  const hero = await getHeroCall().catch((error: unknown) => {
    if (!isDatabaseUnavailable(error)) throw error
    console.error('[sign-in] operational preview unavailable')
    return null
  })
  const items = hero ? buildRecordItems(hero.turns, hero.tools, hero.durationSeconds) : []

  return (
    <div className="auth">
      <div className="auth__panel">
        <Link href="/" aria-label="مُجاوِب MUJAWIB" style={{ inlineSize: 'fit-content' }}>
          <Logo size="xl" priority />
        </Link>

        <div className="auth__head">
          <span className="auth__eyebrow">لوحة التشغيل</span>
          <h1>تسجيل الدخول</h1>
          <p>ادخل إلى مساحة عملك لمتابعة المكالمات والنتائج والتنفيذ من شاشة واحدة.</p>
        </div>

        <SignInForm googleEnabled={GOOGLE_ENABLED} returnTo={returnTo} />
      </div>

      <aside className="auth__aside on-ink">
        <div className="auth__aside-art" aria-hidden="true" />
        <div className="auth__aside-copy">
          <span className="auth__aside-kicker">
            <Radio size={14} aria-hidden="true" />
            تشغيل صوتي مباشر
          </span>
          <h2>كل مكالمة واضحة، من أول كلمة إلى آخر إجراء.</h2>
          <p>راقب ما فهمه الموظف الصوتي، وما نفّذه داخل أنظمتك، والنتيجة التي تركها لفريقك.</p>
        </div>

        <div className="auth__assurance">
          <span>
            <Activity size={15} aria-hidden="true" />
            متابعة لحظية
          </span>
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            سجل تدقيق كامل
          </span>
        </div>

        {hero ? (
          <CallRecord
            locale="ar"
            title="سجل المكالمة"
            meta={`${hero.workspaceName} · تشغيل موثّق`}
            items={items}
            outcome={
              hero.booking?.service
                ? {
                    label: `تم الحجز — ${hero.booking.service}`,
                    detail: clock(hero.booking.scheduledAt),
                  }
                : null
            }
            totalSeconds={hero.durationSeconds}
            animate={false}
          />
        ) : null}
      </aside>
    </div>
  )
}
