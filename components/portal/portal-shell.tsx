'use client'

import {
  CalendarCheck,
  FileText,
  Home,
  Menu,
  MessageSquare,
  Moon,
  Phone,
  Plug,
  Sun,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import { Pill } from '@/components/ui/primitives'
import { useTheme } from '@/components/ui/theme'

const NAV = [
  { href: '/portal', label: 'نظرة عامة', Icon: Home },
  { href: '/portal/calls', label: 'المكالمات', Icon: Phone },
  { href: '/portal/bookings', label: 'الحجوزات', Icon: CalendarCheck },
  { href: '/portal/customers', label: 'العملاء', Icon: Users },
  { href: '/portal/insights', label: 'الرؤى', Icon: TrendingUp },
  { href: '/portal/business-info', label: 'بيانات النشاط', Icon: FileText },
  { href: '/portal/integrations', label: 'الربط', Icon: Plug },
  { href: '/portal/requests', label: 'طلبات التعديل', Icon: MessageSquare },
]

export function PortalShell({
  children,
  workspaceName,
  health,
}: {
  children: ReactNode
  workspaceName: string
  health: { state: 'excellent' | 'needs_attention'; label: string }
}) {
  const pathname = usePathname()
  const { mode, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [])

  return (
    <div className="shell">
      <aside className="sidebar" data-open={open}>
        <div className="sidebar__brand">
          <Link href="/portal" aria-label="مُجاوِب — بوابة العميل">
            <Logo size="sm" />
          </Link>
        </div>

        <div className="sidebar__group">{workspaceName}</div>

        <nav className="sidebar__nav" aria-label="تنقل بوابة العميل">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/portal' ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="nav-item"
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar__foot">
          <div className="portal-health">
            <span className="label">حالة الخدمة</span>
            <Pill tone={health.state === 'excellent' ? 'good' : 'warn'} dot>
              {health.label}
            </Pill>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn console-mobile-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          <strong style={{ fontSize: 'var(--step-0)' }}>{workspaceName}</strong>

          <div className="topbar__right">
            <button type="button" className="icon-btn" onClick={toggle} aria-label="تبديل الوضع">
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link href="/portal/requests" className="btn btn--primary btn--sm">
              اطلب تعديلًا
            </Link>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {open ? (
        <button
          type="button"
          className="shell__scrim"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
