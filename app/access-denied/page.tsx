import { ShieldX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = {
  title: 'الوصول غير متاح',
  robots: { index: false, follow: false },
}

export default function AccessDeniedPage() {
  return (
    <main className="notfound">
      <Link href="/" aria-label="مُجاوِب MUJAWIB">
        <Logo size="lg" />
      </Link>
      <ShieldX size={34} strokeWidth={1.5} aria-hidden="true" />
      <h1>هذا القسم غير متاح لحسابك</h1>
      <p className="notfound__lead">
        تم تسجيل الدخول بنجاح، لكن حسابك لا يملك صلاحية هذا القسم. اطلب من مالك المنصة إضافتك إلى
        مساحة العمل المناسبة.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href="/portal" className="btn btn--primary">
          بوابة العميل
        </Link>
        <Link href="/console" className="btn">
          لوحة التشغيل
        </Link>
        <Link href="/" className="btn btn--quiet">
          الصفحة الرئيسية
        </Link>
      </div>
    </main>
  )
}
