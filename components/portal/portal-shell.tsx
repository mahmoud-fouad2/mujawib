'use client'

import {
  CalendarCheck,
  Eye,
  FileText,
  Hash,
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
import { AccountMenu } from '@/components/auth/account-menu'
import { Logo } from '@/components/brand/logo'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { Pill } from '@/components/ui/primitives'
import { useAction } from '@/components/ui/row-actions'
import { useTheme } from '@/components/ui/theme'
import type { NotificationFeed } from '@/lib/notifications'
import { selectPortalWorkspace } from '@/server/actions/portal'

const NAV = [
  { href: '/portal', label: 'نظرة عامة', Icon: Home },
  { href: '/portal/calls', label: 'المكالمات', Icon: Phone },
  { href: '/portal/bookings', label: 'الحجوزات', Icon: CalendarCheck },
  { href: '/portal/customers', label: 'العملاء', Icon: Users },
  { href: '/portal/insights', label: 'الرؤى', Icon: TrendingUp },
  { href: '/portal/business-info', label: 'بيانات النشاط', Icon: FileText },
  { href: '/portal/integrations', label: 'الربط', Icon: Plug },
  { href: '/portal/phone', label: 'الأرقام', Icon: Hash },
  { href: '/portal/requests', label: 'طلبات التعديل', Icon: MessageSquare },
]

export function PortalShell({
  children,
  workspaceId,
  workspaceName,
  workspaceSlug,
  workspaces,
  user,
  health,
  notifications,
  viewingAsOperator,
}: {
  children: ReactNode
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  workspaces: { id: string; name: string; slug: string }[]
  user: { name: string; email: string }
  health: { state: 'excellent' | 'needs_attention'; label: string }
  notifications: NotificationFeed
  /** Set when a MUJAWIB operator is viewing, not the client themselves. */
  viewingAsOperator?: boolean
}) {
  const pathname = usePathname()
  const { mode, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    if (pathname) setOpen(false)
  }, [pathname])

  return (
    <div className="shell" data-operator-view={viewingAsOperator ? 'true' : undefined}>
      {/*
        Stated plainly and permanently. The portal is identical whoever opens
        it, and an operator reading "مكالماتك" without this banner would be
        reading the client's numbers as their own.
      */}
      {viewingAsOperator ? (
        <div className="operator-view-bar" role="status">
          <Eye size={14} aria-hidden="true" />
          <span>
            تعرض بوابة <strong>{workspaceName}</strong> بصفتك فريق مُجاوِب — قراءة فقط.
          </span>
          <Link href="/console/clients">عودة إلى لوحة التشغيل</Link>
        </div>
      ) : null}
      <aside className="sidebar" data-open={open}>
        <div className="sidebar__brand">
          <Link href="/portal" aria-label="مُجاوِب — بوابة العميل">
            <Logo size="sm" />
          </Link>
        </div>

        <div className="sidebar__workspace">
          <label htmlFor="portal-workspace">مساحة العمل</label>
          <select
            id="portal-workspace"
            className="input"
            value={workspaceSlug}
            disabled={pending || workspaces.length < 2}
            onChange={(event) => run(() => selectPortalWorkspace(event.target.value))}
          >
            {workspaces.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

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
            <NotificationCenter feed={notifications} scopeWorkspaceId={workspaceId} />
            <button type="button" className="icon-btn" onClick={toggle} aria-label="تبديل الوضع">
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link href="/portal/requests" className="btn btn--primary btn--sm">
              اطلب تعديلًا
            </Link>
            <AccountMenu name={user.name} email={user.email} />
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
