export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const
export const NOTIFICATION_CATEGORIES = [
  'call',
  'integration',
  'qa',
  'change_request',
  'system',
  'access',
] as const

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export type NotificationItem = {
  id: string
  severity: NotificationSeverity
  category: NotificationCategory
  title: string
  message: string
  href: string | null
  read: boolean
  createdLabel: string
}

export type NotificationFeed = {
  items: NotificationItem[]
  unreadCount: number
}

/** Notification links stay inside MUJAWIB and never accept protocol-relative URLs. */
export function isSafeNotificationHref(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith('/') && !value.startsWith('//'))
}
