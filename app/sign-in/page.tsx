import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Logo } from '@/components/brand/logo'
import { CallRecord } from '@/components/site/call-record'
import { clock } from '@/lib/format'
import { buildRecordItems } from '@/lib/record'
import { GOOGLE_ENABLED } from '@/server/auth'
import { getHeroCall } from '@/server/data/marketing'
import { isDatabaseUnavailable } from '@/server/db'

export const metadata: Metadata = { title: 'تسجيل الدخول' }
export const dynamic = 'force-dynamic'

function safeReturnTo(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/auth/continue'
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const returnTo = safeReturnTo((await searchParams).next)
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
          <Logo size="lg" priority />
        </Link>

        <div className="auth__head">
          <h1>لوحة التشغيل</h1>
          <p>ادخل لمتابعة المكالمات المباشرة، طابور المراجعة، وحالة الربط والأرقام.</p>
        </div>

        <SignInForm googleEnabled={GOOGLE_ENABLED} returnTo={returnTo} />
      </div>

      <aside className="auth__aside on-ink">
        <div className="auth__aside-copy">
          <h2>هذا ما تراه بعد الدخول.</h2>
          <p>
            سجل كامل لكل مكالمة — الحوار، الأدوات التي نُفِّذت، والنتيجة المسجّلة. المعروض أدناه مكالمة
            فعلية من قاعدة بيانات المنصة، وليست صورة توضيحية.
          </p>
        </div>

        {hero ? (
          <CallRecord
            locale="ar"
            title="سجل المكالمة"
            meta={`${hero.workspaceName} · مسار حجز نموذجي`}
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
