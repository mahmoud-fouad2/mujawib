'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MuiThemeProvider } from '@/components/material/mui-theme-provider'
import { ThemeController } from '@/components/theme-controller'

/**
 * MUJAWIB design system split:
 * - Primer (@primer/react): Operator Console — dense ops UI, sidebar, tables, status pills
 * - Material 3 (@mui/material): Client portal, forms, dialogs, marketing CTAs
 * - Shared tokens: lib/mui-theme.ts + app/globals.css (--mjw-accent, Primer overrides)
 * Color mode is unified via ThemeController (single dark/light toggle).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeController>
        <MuiThemeProvider>{children}</MuiThemeProvider>
      </ThemeController>
    </QueryClientProvider>
  )
}
