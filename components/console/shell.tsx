'use client'

import {
  Activity,
  FlaskConical,
  FolderTree,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  PanelLeftOpen,
  PanelRightClose,
  Phone,
  Plug,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { AccountMenu } from '@/components/auth/account-menu'
import { Logo, LogoMark } from '@/components/brand/logo'
import { type CommandIndex, CommandPalette } from '@/components/console/command-palette'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { useTheme } from '@/components/ui/theme'
import { canOperator } from '@/lib/access'
import { CONSOLE_NAV, isNavActive, type NavIconKey } from '@/lib/console-nav'
import { num } from '@/lib/format'
import type { NotificationFeed } from '@/lib/notifications'

const ICONS: Record<NavIconKey, typeof Home> = {
  home: Home,
  live: Radio,
  calls: Activity,
  qa: ShieldCheck,
  clients: Users,
  inquiries: UserPlus,
  agents: LayoutGrid,
  templates: FolderTree,
  voice: Settings,
  test: FlaskConical,
  integrations: Plug,
  phone: Phone,
  access: UserRoundCog,
  system: Settings,
}

export type NavCounts = { live: number; review: number }

const SIDEBAR_PIN_KEY = 'mujawib.sidebar.pin'

export function ConsoleShell({
  children,
  counts,
  index,
  role,
  notifications,
  user,
}: {
  children: ReactNode
  counts: NavCounts
  index: CommandIndex
  role: string
  notifications: NotificationFeed
  user: { name: string; email: string }
}) {
  const pathname = usePathname()
  const { mode, toggle } = useTheme()
  /**
   * Pinned open is the operator's stated preference; the rail is the default.
   * `null` means we have not read the stored preference yet, which keeps the
   * first client render identical to the server's and avoids a hydration
   * mismatch on an element as large as the sidebar.
   */
  const [pinned, setPinned] = useState<boolean | null>(null)
  /** Transient expansion from pointer or keyboard — never persisted. */
  const [peeking, setPeeking] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_PIN_KEY)
    if (stored === 'pinned' || stored === 'rail') {
      setPinned(stored === 'pinned')
      return
    }
    // No preference yet: pin on displays with room to spare, rail otherwise.
    setPinned(window.matchMedia('(min-width: 1440px)').matches)
  }, [])

  const togglePin = useCallback(() => {
    setPinned((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_PIN_KEY, next ? 'pinned' : 'rail')
      // Peeking would otherwise keep the rail open right after unpinning.
      if (!next) setPeeking(false)
      return next
    })
  }, [])

  const rail = pinned === false
  // Expanded while peeking, but the layout still reserves only the rail's
  // width, so the page underneath never reflows as it opens.
  const expanded = pinned === true || peeking

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    if (pathname) setMobileOpen(false)
  }, [pathname])

  const openPalette = useCallback(() => setPaletteOpen(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell" data-rail={rail} data-expanded={expanded}>
      <aside
        className="sidebar"
        data-open={mobileOpen}
        // Pointer and keyboard both expand the rail. `focus-within` alone
        // would miss the pointer, and hover alone would strand keyboard users
        // on a strip of unlabelled icons.
        onMouseEnter={() => rail && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
        onFocus={() => rail && setPeeking(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPeeking(false)
        }}
      >
        <div className="sidebar__brand">
          <Link href="/console" aria-label="مُجاوِب — لوحة التشغيل">
            <span className="sidebar__mark">
              <LogoMark size={30} />
            </span>
            <span className="sidebar__wordmark">
              <Logo size="md" />
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar__pin"
            onClick={togglePin}
            aria-pressed={pinned === true}
            title={rail ? 'تثبيت الشريط مفتوحًا' : 'طي الشريط إلى أيقونات'}
            aria-label={rail ? 'تثبيت الشريط مفتوحًا' : 'طي الشريط إلى أيقونات'}
          >
            {rail ? <PanelLeftOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="التنقل في لوحة التشغيل">
          {CONSOLE_NAV.map((group) => (
            <div key={group.title}>
              <div className="sidebar__group">{group.title}</div>
              {group.items
                .filter(
                  (item) =>
                    (!item.ownerOnly || role === 'owner') &&
                    (!item.requiredPermission || canOperator(role, item.requiredPermission)),
                )
                .map((item) => {
                  const Icon = ICONS[item.icon]
                  const active = isNavActive(pathname, item.href)
                  const count = item.badge ? counts[item.badge] : 0
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="nav-item"
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span className="nav-item__label">{item.label}</span>
                      {item.badge && count > 0 ? (
                        <span className="nav-item__count">{num(count)}</span>
                      ) : null}
                      {/* Shown by CSS only while the rail is closed. */}
                      <span className="nav-item__tip" aria-hidden="true">
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <Link href="/portal" className="nav-item">
            <Users size={16} aria-hidden="true" />
            <span className="nav-item__label">بوابة العميل</span>
            <span className="nav-item__tip" aria-hidden="true">
              بوابة العميل
            </span>
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn console-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button type="button" className="topbar__search" onClick={openPalette}>
            <Search size={15} aria-hidden="true" />
            <span>ابحث عن مكالمة أو عميل أو رقم…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="topbar__right">
            <NotificationCenter feed={notifications} />
            <button type="button" className="icon-btn" onClick={toggle} aria-label="تبديل الوضع">
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <AccountMenu name={user.name} email={user.email} />
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="shell__scrim"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        index={index}
        role={role}
      />
    </div>
  )
}
