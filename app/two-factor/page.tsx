import type { Metadata } from 'next'
import Link from 'next/link'
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = { title: 'التحقق بخطوتين' }

export default function TwoFactorPage() {
  return (
    <main className="auth auth--single">
      <section className="auth__panel">
        <Link href="/" aria-label="مُجاوِب">
          <Logo size="lg" priority />
        </Link>
        <TwoFactorChallenge />
      </section>
    </main>
  )
}
