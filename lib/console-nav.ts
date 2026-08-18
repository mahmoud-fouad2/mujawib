/**
 * Console navigation — Bible §5A.
 *
 * Grouped so the sidebar stays scannable instead of becoming a flat list of
 * twelve equal items. Icons are referenced by key and resolved in the sidebar,
 * which keeps this module serialisable across the server/client boundary.
 */

export type NavIconKey =
  | 'home'
  | 'live'
  | 'calls'
  | 'qa'
  | 'clients'
  | 'agents'
  | 'templates'
  | 'voice'
  | 'integrations'
  | 'phone'
  | 'system'

export type NavItem = {
  id: string
  label: string
  href: string
  icon: NavIconKey
  /** Which live count, if any, belongs on this row. */
  badge?: 'live' | 'review'
  keywords: string[]
}

export type NavGroup = { title: string; items: NavItem[] }

export const CONSOLE_NAV: NavGroup[] = [
  {
    title: 'التشغيل',
    items: [
      {
        id: 'home',
        label: 'الرئيسية',
        href: '/console',
        icon: 'home',
        keywords: ['home', 'overview', 'رئيسية'],
      },
      {
        id: 'live',
        label: 'المباشر',
        href: '/console/live',
        icon: 'live',
        badge: 'live',
        keywords: ['live', 'now', 'مباشر'],
      },
      {
        id: 'calls',
        label: 'المكالمات',
        href: '/console/calls',
        icon: 'calls',
        keywords: ['calls', 'inbox', 'مكالمات'],
      },
      {
        id: 'qa',
        label: 'الجودة',
        href: '/console/qa',
        icon: 'qa',
        badge: 'review',
        keywords: ['qa', 'review', 'جودة', 'مراجعة'],
      },
    ],
  },
  {
    title: 'الإعداد',
    items: [
      {
        id: 'clients',
        label: 'العملاء',
        href: '/console/clients',
        icon: 'clients',
        keywords: ['clients', 'عملاء'],
      },
      {
        id: 'agents',
        label: 'الموظفون الصوتيون',
        href: '/console/agents',
        icon: 'agents',
        keywords: ['agents', 'موظفين'],
      },
      {
        id: 'templates',
        label: 'القوالب',
        href: '/console/templates',
        icon: 'templates',
        keywords: ['templates', 'packs', 'قوالب'],
      },
      {
        id: 'voice-lab',
        label: 'مختبر الصوت',
        href: '/console/voice-lab',
        icon: 'voice',
        keywords: ['voice', 'pronunciation', 'صوت', 'نطق'],
      },
    ],
  },
  {
    title: 'البنية',
    items: [
      {
        id: 'integrations',
        label: 'الربط',
        href: '/console/integrations',
        icon: 'integrations',
        keywords: ['integrations', 'ربط', 'تكامل'],
      },
      {
        id: 'phone',
        label: 'الهاتف',
        href: '/console/phone',
        icon: 'phone',
        keywords: ['phone', 'sip', 'هاتف'],
      },
      {
        id: 'system',
        label: 'النظام',
        href: '/console/system',
        icon: 'system',
        keywords: ['system', 'audit', 'نظام'],
      },
    ],
  },
]

export const CONSOLE_NAV_FLAT = CONSOLE_NAV.flatMap((g) => g.items)

export function isNavActive(pathname: string, href: string) {
  if (href === '/console') return pathname === '/console'
  return pathname === href || pathname.startsWith(`${href}/`)
}
