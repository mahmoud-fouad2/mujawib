import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SecuritySettings } from '@/components/auth/security-settings'
import { Logo } from '@/components/brand/logo'
import { getOperatorAccess, getPortalAccess } from '@/server/auth/access'
import { requireSession } from '@/server/auth/session'

export const metadata: Metadata = { title: 'أمان الحساب' }
export const dynamic = 'force-dynamic'

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>
}) {
  const session = await requireSession('/account/security')
  const required = (await searchParams).required === 'operator'
  const [operator, portal] = await Promise.all([getOperatorAccess(), getPortalAccess()])
  const returnTo = operator ? '/console' : portal ? '/portal' : '/'
  const enabled = Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled)

  return (
    <main className="account-page">
      <header className="account-page__bar">
        <Link href={returnTo} className="btn btn--quiet btn--sm">
          <ArrowLeft size={15} className="arrow" />
          العودة
        </Link>
        <Logo size="sm" />
      </header>
      <div className="account-page__content">
        <div className="account-page__head">
          <span>الحساب</span>
          <h1>أمان تسجيل الدخول</h1>
          <p>{session.user.email}</p>
          {required && !enabled ? (
            <div className="account-page__notice">
              حسابات فريق التشغيل تتطلب تحققًا بخطوتين قبل فتح لوحة التحكم.
            </div>
          ) : null}
        </div>
        <SecuritySettings initiallyEnabled={enabled} returnTo={returnTo} required={required} />
      </div>
    </main>
  )
}
