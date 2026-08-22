import type { Metadata } from 'next'
import Link from 'next/link'
import { PasswordResetRequest } from '@/components/auth/password-recovery'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = { title: 'استعادة كلمة المرور', robots: { index: false } }

export default function ForgotPasswordPage() {
  return (
    <main className="auth recovery-page">
      <section className="auth__panel">
        <Link href="/" aria-label="مُجاوِب MUJAWIB" style={{ inlineSize: 'fit-content' }}>
          <Logo size="lg" priority />
        </Link>
        <PasswordResetRequest />
      </section>
      <aside className="auth__aside on-ink">
        <div className="auth__aside-copy">
          <h2>استعادة آمنة، بلا كشف للحسابات.</h2>
          <p>الرابط أحادي الاستخدام، ينتهي خلال ساعة، ويلغي الجلسات السابقة بعد نجاح التغيير.</p>
        </div>
      </aside>
    </main>
  )
}
