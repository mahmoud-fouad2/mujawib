'use client'

import { ArrowLeft, ArrowRight, Menu, Moon, Sun, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import { LinkButton } from '@/components/ui/button'
import { useTheme } from '@/components/ui/theme'
import type { SiteCopy } from '@/lib/content/site'
import { isRtl, type Locale, localePath, switchLocalePath } from '@/lib/i18n'

export function SiteHeader({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { mode, toggle } = useTheme()
  const pathname = usePathname()
  const rtl = isRtl(locale)
  const Arrow = rtl ? ArrowLeft : ArrowRight

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the sheet on navigation. Keyed on the path: an empty dependency list
  // only ran on mount, so tapping a link left the sheet covering the new page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const otherLocale: Locale = locale === 'ar' ? 'en' : 'ar'
  const langHref = switchLocalePath(pathname, otherLocale)

  return (
    <>
      <header className="site-header" data-scrolled={scrolled}>
        <div className="container site-header__inner">
          <Link
            href={localePath(locale, '/')}
            className="site-header__brand"
            aria-label="مُجاوِب MUJAWIB"
          >
            <Logo size="xl" priority />
          </Link>

          <nav className="site-nav" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main'}>
            {copy.nav.map((item) => (
              <Link
                key={item.href}
                href={localePath(locale, item.href)}
                aria-current={pathname === localePath(locale, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="site-header__actions">
            {/* A full page load is correct here: the document direction changes. */}
            <a href={langHref} className="lang-switch" hrefLang={otherLocale}>
              {copy.common.langSwitch}
            </a>

            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={copy.common.theme}
            >
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <Link href="/sign-in" className="btn btn--quiet btn--sm site-header__signin">
              {copy.common.signIn}
            </Link>

            <LinkButton
              href={localePath(locale, '/contact')}
              variant="primary"
              size="sm"
              className="site-header__cta"
              trailing={<Arrow size={15} className="arrow" aria-hidden="true" />}
            >
              {copy.common.bookDemo}
            </LinkButton>

            <button
              type="button"
              className="icon-btn site-header__menu"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? copy.common.close : copy.common.menu}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="site-sheet">
          {copy.nav.map((item) => (
            <Link key={item.href} href={localePath(locale, item.href)}>
              {item.label}
            </Link>
          ))}
          <div className="site-sheet__actions">
            <LinkButton href="/sign-in" size="md" block>
              {copy.common.signIn}
            </LinkButton>
            <LinkButton href={localePath(locale, '/contact')} variant="primary" size="md" block>
              {copy.common.bookDemo}
            </LinkButton>
          </div>
        </div>
      ) : null}
    </>
  )
}
