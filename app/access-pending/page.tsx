import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccessPendingActions } from '@/components/auth/access-pending-actions'
import { Logo } from '@/components/brand/logo'
import { getOperatorAccess, getPortalAccess } from '@/server/auth/access'
import { requireSession } from '@/server/auth/session'

export const metadata: Metadata = {
  title: 'الحساب قيد الربط',
  robots: { index: false, follow: false },
}

export default async function AccessPendingPage() {
  const session = await requireSession('/access-pending')
  const [operator, portal] = await Promise.all([getOperatorAccess(), getPortalAccess()])
  if (operator) redirect('/console')
  if (portal) redirect('/portal')

  return (
    <main className="auth access-pending">
      <section className="auth__panel">
        <Link href="/" aria-label="مُجاوِب MUJAWIB" style={{ inlineSize: 'fit-content' }}>
          <Logo size="lg" priority />
        </Link>
        <div className="auth__head">
          <span className="access-pending__status">الحساب آمن، والربط لم يكتمل بعد</span>
          <h1>نحتاج ربط حسابك بمساحة العمل.</h1>
          <p>
            دخلت بالبريد{' '}
            <span className="mono" dir="ltr">
              {session.user.email}
            </span>
            ، لكن لا توجد شركة أو صلاحية مرتبطة به حتى الآن. اطلب من مسؤول مُجاوِب إرسال دعوة لهذا
            البريد.
          </p>
        </div>
        <AccessPendingActions />
      </section>
      <aside className="auth__aside on-ink">
        <div className="auth__aside-copy">
          <h2>كل حساب يرى ما يخصه فقط.</h2>
          <p>
            نفصل هوية المستخدم عن صلاحيات التشغيل وبيانات العملاء. لذلك لا نفتح لوحة افتراضية ولا
            نختار أول شركة متاحة عندما تكون الصلاحية غير واضحة.
          </p>
        </div>
      </aside>
    </main>
  )
}
