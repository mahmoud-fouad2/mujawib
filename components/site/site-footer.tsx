import { MessageSquare } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { InstagramMark, LinkedInMark } from '@/components/brand/social-marks'
import type { SiteCopy } from '@/lib/content/site'
import { type Locale, localePath } from '@/lib/i18n'
import type { PlatformContact } from '@/server/data/platform'

/**
 * Only profiles that resolve. `x.com/mujawib` and `youtube.com/@mujawib` both
 * returned 404 — a footer icon that leads nowhere costs more trust than a
 * missing one. Add each back here once the handle is actually claimed.
 */
const SOCIAL = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/mujawib', Icon: LinkedInMark },
  { label: 'Instagram', href: 'https://www.instagram.com/mujawib', Icon: InstagramMark },
]

export function SiteFooter({
  locale,
  copy,
  contact,
}: {
  locale: Locale
  copy: SiteCopy
  contact: PlatformContact
}) {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href={localePath(locale, '/')} aria-label="مُجاوِب MUJAWIB">
              <Logo size="xl" locale={locale} />
            </Link>
            <strong className="site-footer__tagline">{copy.footer.tagline}</strong>
            <p>{copy.footer.description}</p>

            <div className="site-footer__contact">
              {contact.email ? (
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              ) : (
                <Link href={localePath(locale, '/contact')} data-cta="footer_contact">
                  <MessageSquare size={14} aria-hidden="true" />
                  {locale === 'ar' ? 'تواصل معنا' : 'Contact us'}
                </Link>
              )}
              {contact.phone ? (
                <a href={`tel:${contact.phone.e164}`} className="mono">
                  {contact.phone.display}
                </a>
              ) : null}
            </div>

            <div className="site-footer__social">
              {SOCIAL.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Icon size={16} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="site-footer__cols">
            {copy.footer.columns.map((col) => (
              <div key={col.title} className="site-footer__col">
                <h3>{col.title}</h3>
                {col.links.map((l) => (
                  <Link key={`${col.title}-${l.label}`} href={localePath(locale, l.href)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer__bar">
          <span>
            © {year} {locale === 'ar' ? 'مُجاوِب' : 'Mujawib'}. {copy.footer.rights}
          </span>

          <div className="site-footer__bar-links">
            <Link href={localePath(locale, '/privacy')}>{copy.footer.privacy}</Link>
            <Link href={localePath(locale, '/terms')}>{copy.footer.terms}</Link>
          </div>

          <a
            href="https://ma-fo.info"
            className="site-footer__credit"
            target="_blank"
            rel="author noreferrer noopener"
          >
            <Image src="/images/brand/ma-fo-logo.png" alt="" width={22} height={22} />
            <span>
              Developed by <strong>Ma-Fo</strong>
            </span>
          </a>
        </div>
      </div>
    </footer>
  )
}
