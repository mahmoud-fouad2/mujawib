import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <div className="notfound">
      <Link href="/" aria-label="مُجاوِب MUJAWIB">
        <Logo size="lg" />
      </Link>
      <p className="label">404</p>
      <h1>الصفحة غير موجودة</h1>
      <p className="notfound__lead">
        الرابط الذي فتحته لم يعد متاحًا أو تغيّر عنوانه. يمكنك العودة إلى الصفحة الرئيسية أو فتح لوحة
        التشغيل مباشرة.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href="/" className="btn btn--primary">
          الصفحة الرئيسية
        </Link>
        <Link href="/console" className="btn">
          لوحة التشغيل
        </Link>
      </div>
    </div>
  )
}
