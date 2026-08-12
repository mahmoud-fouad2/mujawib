'use client'

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { ThemeProvider } from '@mui/material/styles'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { createMujawibTheme } from '@/lib/mui-theme'
import { useColorMode } from '@/components/theme-controller'

/**
 * Material 3 theme layer — client portal, forms, dialogs, marketing CTAs.
 * Syncs color mode with Primer ThemeController (shared dark/light toggle).
 */
export function MuiThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useColorMode()
  const theme = createMujawibTheme(mode)

  return (
    <AppRouterCacheProvider options={{ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] }}>
      <ThemeProvider theme={theme} defaultMode={mode}>
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
