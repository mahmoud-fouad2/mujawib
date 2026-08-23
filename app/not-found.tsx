import { headers } from 'next/headers'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import type { Locale } from '@/lib/i18n'

/**
 * Reached from both locales, so it reads the locale middleware resolved rather
 * than assuming Arabic. The second action used to be the console, which is a
 * sign-in wall for the visitors who actually land here from a stale link.
 */
export default async function NotFound() {
  const locale = ((await headers()).get('x-locale') ?? 'ar') as Locale
  const ar = locale === 'ar'
  const home = ar ? '/' : '/en'

  return (
    <div className="notfound">
      <Link href={home} aria-label="مُجاوِب MUJAWIB">
        <Logo size="lg" />
      </Link>
      <p className="label">404</p>
      <h1>{ar ? 'الصفحة غير موجودة' : 'Page not found'}</h1>
      <p className="notfound__lead">
        {ar
          ? 'الرابط الذي فتحته لم يعد متاحًا أو تغيّر عنوانه. ابدأ من الصفحة الرئيسية، أو اسأل الفريق مباشرة عمّا تبحث عنه.'
          : 'The link you followed is gone or has moved. Start from the home page, or ask the team directly for what you were looking for.'}
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href={home} className="btn btn--primary">
          {ar ? 'الصفحة الرئيسية' : 'Home page'}
        </Link>
        <Link href={ar ? '/contact' : '/en/contact'} className="btn">
          {ar ? 'تواصل مع الفريق' : 'Talk to the team'}
        </Link>
      </div>
    </div>
  )
}
