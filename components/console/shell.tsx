'use client'

import {
  Activity,
  FlaskConical,
  FolderTree,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Collapse to icons on laptop widths — Bible §6.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1280px)')
    const sync = () => setCollapsed(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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
    <div className="shell" data-collapsed={collapsed}>
      <aside className="sidebar" data-open={mobileOpen}>
        <div className="sidebar__brand">
          <Link href="/console" aria-label="مُجاوِب — لوحة التشغيل">
            {collapsed ? <LogoMark size={30} /> : <Logo size="md" />}
          </Link>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
                      title={collapsed ? item.label : undefined}
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badge && count > 0 ? (
                        <span className="nav-item__count">{num(count)}</span>
                      ) : null}
                    </Link>
                  )
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <Link href="/portal" className="nav-item">
            <Users size={16} aria-hidden="true" />
            <span>بوابة العميل</span>
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
