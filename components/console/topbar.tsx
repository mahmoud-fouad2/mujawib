'use client'

import { Avatar, IconButton, Stack, Text } from '@primer/react'
import { BellIcon, ChevronDownIcon, SearchIcon } from '@primer/octicons-react'
import { ThemeToggle } from '@/components/theme-toggle'

export function ConsoleTopbar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 24px',
        background: 'color-mix(in srgb, var(--bgColor-default) 82%, transparent)',
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: '1px solid var(--borderColor-muted)',
      }}
    >
      {/* Profile + notifications + theme (start side in RTL = right) */}
      <Stack direction="horizontal" gap="condensed" align="center">
        <Avatar src="/console/avatar-user.png" size={32} alt="حسابك" />
        <IconButton icon={BellIcon} aria-label="الإشعارات" variant="invisible" />
        <ThemeToggle />
      </Stack>

      {/* Command / search */}
      <div style={{ flex: 1, maxWidth: 520 }}>
        <button
          type="button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '9px 14px',
            borderRadius: 'var(--borderRadius-full)',
            border: '1px solid var(--borderColor-default)',
            background: 'var(--bgColor-muted)',
            color: 'var(--fgColor-muted)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Stack direction="horizontal" align="center" gap="condensed">
            <SearchIcon size={16} />
            <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
              ابحث في مُجاوِب...
            </Text>
          </Stack>
          <kbd
            style={{
              fontSize: 12,
              padding: '2px 7px',
              borderRadius: 'var(--borderRadius-medium)',
              border: '1px solid var(--borderColor-default)',
              background: 'var(--bgColor-default)',
              color: 'var(--fgColor-muted)',
              fontFamily: 'var(--fontStack-monospace)',
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Workspace switcher (end side in RTL = left) */}
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px 6px 8px',
          borderRadius: 'var(--borderRadius-full)',
          border: '1px solid var(--borderColor-default)',
          background: 'var(--bgColor-default)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <ChevronDownIcon size={14} />
        <Text size="small" weight="semibold">
          الشركة التجريبية
        </Text>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--borderRadius-medium)',
            background: 'var(--bgColor-accent-emphasis)',
            color: 'var(--fgColor-onEmphasis)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ش
        </span>
      </button>
    </header>
  )
}
