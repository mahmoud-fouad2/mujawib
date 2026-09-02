import type { OperatorPermission } from '@/lib/access'

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
  | 'inquiries'
  | 'campaigns'
  | 'agents'
  | 'templates'
  | 'voice'
  | 'test'
  | 'integrations'
  | 'phone'
  | 'access'
  | 'content'
  | 'system'

type NavItem = {
  id: string
  label: string
  href: string
  icon: NavIconKey
  /** Which live count, if any, belongs on this row. */
  badge?: 'live' | 'review'
  ownerOnly?: boolean
  requiredPermission?: OperatorPermission
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
        requiredPermission: 'qa.review',
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
        requiredPermission: 'client.manage',
        keywords: ['clients', 'عملاء'],
      },
      {
        id: 'inquiries',
        label: 'طلبات العروض',
        href: '/console/inquiries',
        icon: 'inquiries',
        requiredPermission: 'client.manage',
        keywords: ['leads', 'sales', 'طلبات', 'عروض'],
      },
      {
        id: 'campaigns',
        label: 'الحملات الصادرة',
        href: '/console/campaigns',
        icon: 'campaigns',
        requiredPermission: 'campaign.approve',
        keywords: ['campaign', 'outbound', 'حملة', 'حملات', 'اتصال صادر'],
      },
      {
        id: 'agents',
        label: 'الموظفون الصوتيون',
        href: '/console/agents',
        icon: 'agents',
        requiredPermission: 'agent.publish',
        keywords: ['agents', 'موظفين'],
      },
      {
        id: 'templates',
        label: 'القوالب',
        href: '/console/templates',
        icon: 'templates',
        requiredPermission: 'client.manage',
        keywords: ['templates', 'packs', 'قوالب'],
      },
      {
        id: 'test-lab',
        label: 'مختبر الاختبار',
        href: '/console/test-lab',
        icon: 'test',
        requiredPermission: 'test.manage',
        keywords: ['test', 'regression', 'سيناريو', 'اختبار'],
      },
      {
        id: 'voice-lab',
        label: 'مختبر الصوت',
        href: '/console/voice-lab',
        icon: 'voice',
        requiredPermission: 'voice.manage',
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
        requiredPermission: 'integration.manage',
        keywords: ['integrations', 'ربط', 'تكامل'],
      },
      {
        id: 'phone',
        label: 'الهاتف',
        href: '/console/phone',
        icon: 'phone',
        requiredPermission: 'phone.manage',
        keywords: ['phone', 'sip', 'هاتف'],
      },
      {
        id: 'access',
        label: 'الوصول',
        href: '/console/access',
        icon: 'access',
        ownerOnly: true,
        requiredPermission: 'access.manage',
        keywords: ['access', 'roles', 'صلاحيات', 'وصول'],
      },
      {
        id: 'content',
        label: 'المحتوى والإعلانات',
        href: '/console/content',
        icon: 'content',
        requiredPermission: 'content.manage',
        keywords: [
          'content',
          'blog',
          'article',
          'announcement',
          'maintenance',
          'محتوى',
          'مقالات',
          'إعلان',
          'صيانة',
        ],
      },
      {
        id: 'system',
        label: 'النظام',
        href: '/console/system',
        icon: 'system',
        requiredPermission: 'system.view',
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
