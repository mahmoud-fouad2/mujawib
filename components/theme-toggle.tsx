'use client'

import { IconButton } from '@primer/react'
import { MoonIcon, SunIcon } from '@primer/octicons-react'
import { useColorMode } from './theme-controller'

export function ThemeToggle({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const { mode, toggle } = useColorMode()
  return (
    <IconButton
      icon={mode === 'dark' ? SunIcon : MoonIcon}
      aria-label={mode === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      variant="invisible"
      size={size}
      onClick={toggle}
    />
  )
}
