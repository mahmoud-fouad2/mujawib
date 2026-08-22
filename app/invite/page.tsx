import type { Metadata } from 'next'
import Link from 'next/link'
import { InviteAcceptance } from '@/components/auth/invite-acceptance'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = {
  title: 'قبول الدعوة',
  robots: { index: false, follow: false },
}

export default function InvitePage() {
  return (
    <main className="auth invite-page">
      <section className="auth__panel">
        <Link href="/" aria-label="مُجاوِب MUJAWIB" style={{ inlineSize: 'fit-content' }}>
          <Logo size="lg" priority />
        </Link>
        <InviteAcceptance />
      </section>

      <aside className="auth__aside invite-page__aside on-ink">
        <div className="invite-page__eyebrow">مساحة عمل مُدارة وآمنة</div>
        <div className="auth__aside-copy">
          <h2>صلاحيتك تبدأ من المكان الصحيح.</h2>
          <p>
            كل دعوة مرتبطة بشركة ودور محددين. بعد القبول سترى فقط البيانات والعمليات المصرح لك بها،
            من دون إعدادات تقنية أو خطوات إضافية.
          </p>
        </div>
        <ol className="invite-page__steps">
          <li>
            <span>01</span>
            <div>
              <strong>تحقق من الدعوة</strong>
              <small>اسم مساحة العمل والدور يظهران قبل القبول.</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>ادخل ببريدك المدعو</strong>
              <small>لا يمكن نقل الدعوة إلى حساب آخر.</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>ابدأ مباشرة</strong>
              <small>ننقلك تلقائيًا إلى مساحة عملك بعد القبول.</small>
            </div>
          </li>
        </ol>
      </aside>
    </main>
  )
}
