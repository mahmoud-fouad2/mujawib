import Image from 'next/image'
import Link from 'next/link'
// Lucide dropped brand marks in v1; react-icons carries the official glyphs.
import { FaInstagram, FaLinkedinIn, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { Logo } from '@/components/brand/logo'
import type { SiteCopy } from '@/lib/content/site'
import { type Locale, localePath } from '@/lib/i18n'

const SOCIAL = [
  { label: 'LinkedIn', href: 'https://linkedin.com/company/mujawib', Icon: FaLinkedinIn },
  { label: 'X', href: 'https://x.com/mujawib', Icon: FaXTwitter },
  { label: 'Instagram', href: 'https://instagram.com/mujawib', Icon: FaInstagram },
  { label: 'YouTube', href: 'https://youtube.com/@mujawib', Icon: FaYoutube },
]

export function SiteFooter({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link href={localePath(locale, '/')} aria-label="مُجاوِب MUJAWIB">
              <Logo size="xl" />
            </Link>
            <strong className="site-footer__tagline">{copy.footer.tagline}</strong>
            <p>{copy.footer.description}</p>

            <div className="site-footer__contact">
              <a href={`mailto:${copy.footer.email}`}>{copy.footer.email}</a>
              <a href={`tel:${copy.footer.phone.replaceAll(' ', '')}`} className="mono">
                {copy.footer.phone}
              </a>
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
