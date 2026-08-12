'use client'

import { useState } from 'react'
import { NavList, Stack, Text } from '@primer/react'
import {
  CalendarIcon,
  CommentDiscussionIcon,
  DotFillIcon,
  GearIcon,
  GraphIcon,
  HomeIcon,
  PlugIcon,
  ShieldCheckIcon,
  UnmuteIcon,
} from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { MujawibMark } from '@/components/mujawib-mark'

const NAV: { id: string; label: string; icon: Icon }[] = [
  { id: 'home', label: 'الرئيسية', icon: HomeIcon },
  { id: 'calls', label: 'المكالمات', icon: UnmuteIcon },
  { id: 'bookings', label: 'الحجوزات', icon: CalendarIcon },
  { id: 'agents', label: 'الـAgents', icon: CommentDiscussionIcon },
  { id: 'qa', label: 'الجودة', icon: ShieldCheckIcon },
  { id: 'insights', label: 'التحليلات', icon: GraphIcon },
  { id: 'integrations', label: 'التكاملات', icon: PlugIcon },
  { id: 'settings', label: 'الإعدادات', icon: GearIcon },
]

export function ConsoleSidebar() {
  const [active, setActive] = useState('home')
  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--bgColor-emphasis)',
        borderInlineStart: '1px solid var(--borderColor-default)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* aurora glow at top */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -120,
          insetInlineEnd: -60,
          width: 260,
          height: 260,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--bgColor-accent-emphasis) 45%, transparent) 0%, transparent 68%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ padding: '20px 18px', position: 'relative' }}>
        <MujawibMark size={22} onEmphasis />
      </div>

      <nav aria-label="التنقل في لوحة التشغيل" style={{ padding: '0 10px', flex: 1, position: 'relative' }}>
        <NavList>
          {NAV.map((item) => {
            const IconComp = item.icon
            const isActive = active === item.id
            return (
              <NavList.Item
                key={item.id}
                {...(isActive ? { 'aria-current': 'page' as const } : {})}
                className="mjw-nav-item"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  setActive(item.id)
                }}
                href="#"
                style={{
                  color: isActive
                    ? 'var(--fgColor-onEmphasis)'
                    : 'color-mix(in srgb, var(--fgColor-onEmphasis) 62%, transparent)',
                  borderRadius: 'var(--borderRadius-medium)',
                  fontWeight: isActive ? 600 : 400,
                  backgroundColor: isActive
                    ? 'color-mix(in srgb, var(--fgColor-onEmphasis) 12%, transparent)'
                    : undefined,
                }}
              >
                <NavList.LeadingVisual>
                  <span style={{ color: isActive ? 'var(--fgColor-accent)' : 'inherit' }}>
                    <IconComp size={16} />
                  </span>
                </NavList.LeadingVisual>
                {item.label}
              </NavList.Item>
            )
          })}
        </NavList>
      </nav>

      {/* system status card */}
      <div style={{ padding: 12, position: 'relative' }}>
        <div
          style={{
            borderRadius: 'var(--borderRadius-large)',
            border: '1px solid color-mix(in srgb, var(--fgColor-onEmphasis) 14%, transparent)',
            background: 'color-mix(in srgb, var(--fgColor-onEmphasis) 6%, transparent)',
            padding: 14,
          }}
        >
          <Stack direction="vertical" gap="condensed">
            <Stack direction="horizontal" align="center" gap="condensed">
              <span style={{ color: 'var(--fgColor-success)', display: 'inline-flex' }}>
                <DotFillIcon size={14} />
              </span>
              <Text size="small" weight="semibold" style={{ color: 'var(--fgColor-onEmphasis)' }}>
                النظام
              </Text>
            </Stack>
            <Text
              size="small"
              style={{ color: 'color-mix(in srgb, var(--fgColor-onEmphasis) 60%, transparent)', lineHeight: 1.6 }}
            >
              جميع الأنظمة تعمل بشكل طبيعي
            </Text>
            <button
              type="button"
              style={{
                marginTop: 4,
                width: '100%',
                padding: '7px 10px',
                borderRadius: 'var(--borderRadius-medium)',
                border: '1px solid color-mix(in srgb, var(--fgColor-onEmphasis) 16%, transparent)',
                background: 'transparent',
                color: 'var(--fgColor-onEmphasis)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              عرض حالة الأنظمة
            </button>
          </Stack>
        </div>
      </div>
    </aside>
  )
}
