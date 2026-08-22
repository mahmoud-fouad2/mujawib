'use client'

import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { NotificationFeed, NotificationItem, NotificationSeverity } from '@/lib/notifications'
import { markAllNotificationsRead, markNotificationRead } from '@/server/actions/notifications'

const SEVERITY_ICON: Record<NotificationSeverity, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  critical: CircleAlert,
}

const CATEGORY_LABEL: Record<NotificationItem['category'], string> = {
  call: 'المكالمات',
  integration: 'الربط',
  qa: 'الجودة',
  change_request: 'طلبات التعديل',
  system: 'النظام',
  access: 'الوصول',
}

export function NotificationCenter({
  feed,
  scopeWorkspaceId,
}: {
  feed: NotificationFeed
  scopeWorkspaceId?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(feed.items)
  const [unreadCount, setUnreadCount] = useState(feed.unreadCount)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setItems(feed.items)
    setUnreadCount(feed.unreadCount)
  }, [feed])

  useEffect(() => {
    if (pathname) setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const markOne = (item: NotificationItem) => {
    if (item.read) return
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, read: true } : candidate,
      ),
    )
    setUnreadCount((current) => Math.max(0, current - 1))
    startTransition(async () => {
      await markNotificationRead(item.id)
      router.refresh()
    })
  }

  const markAll = () => {
    if (unreadCount === 0) return
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    setUnreadCount(0)
    startTransition(async () => {
      await markAllNotificationsRead(scopeWorkspaceId)
      router.refresh()
    })
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className="icon-btn notification-trigger"
        aria-label={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="notification-trigger__count">
            {unreadCount > 99 ? '99+' : unreadCount.toLocaleString('ar-SA')}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="notification-panel" role="dialog" aria-label="مركز الإشعارات">
          <header className="notification-panel__head">
            <div>
              <strong>الإشعارات</strong>
              <span>{unreadCount > 0 ? `${unreadCount} تحتاج انتباهك` : 'أنت على اطلاع'}</span>
            </div>
            <div className="notification-panel__actions">
              {unreadCount > 0 ? (
                <button type="button" onClick={markAll} disabled={pending}>
                  <CheckCheck size={15} aria-hidden="true" />
                  قراءة الكل
                </button>
              ) : null}
              <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
                <X size={16} aria-hidden="true" />
                <span className="sr-only">إغلاق</span>
              </button>
            </div>
          </header>

          <div className="notification-list">
            {items.length === 0 ? (
              <div className="notification-empty">
                <Bell size={20} aria-hidden="true" />
                <strong>لا توجد إشعارات بعد</strong>
                <span>ستظهر هنا الأحداث التي تحتاج متابعة فعلية.</span>
              </div>
            ) : (
              items.map((item) => {
                const Icon = SEVERITY_ICON[item.severity]
                const content = (
                  <>
                    <span className="notification-item__icon" data-tone={item.severity}>
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="notification-item__body">
                      <span className="notification-item__meta">
                        <span>{CATEGORY_LABEL[item.category]}</span>
                        <time>{item.createdLabel}</time>
                      </span>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                    </span>
                  </>
                )

                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="notification-item"
                    data-read={item.read}
                    onClick={() => markOne(item)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    className="notification-item"
                    data-read={item.read}
                    onClick={() => markOne(item)}
                  >
                    {content}
                  </button>
                )
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
