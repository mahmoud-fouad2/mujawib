import type { Metadata } from 'next'
import Link from 'next/link'
import { PasswordResetForm } from '@/components/auth/password-recovery'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة', robots: { index: false } }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="auth recovery-page">
      <section className="auth__panel">
        <Link href="/" aria-label="مُجاوِب MUJAWIB" style={{ inlineSize: 'fit-content' }}>
          <Logo size="lg" priority />
        </Link>
        <PasswordResetForm token={params.token ?? ''} invalid={Boolean(params.error)} />
      </section>
      <aside className="auth__aside on-ink">
        <div className="auth__aside-copy">
          <h2>بداية جديدة للحساب نفسه.</h2>
          <p>لا تتغير شركتك أو صلاحياتك؛ نحدّث وسيلة الدخول فقط ثم نغلق الجلسات القديمة.</p>
        </div>
      </aside>
    </main>
  )
}
