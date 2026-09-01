'use client'

import { ThemeProvider } from '@/components/ui/theme'
import { ToastProvider } from '@/components/ui/toast'

/**
 * The app owns its design system — tokens in app/tokens.css, primitives in
 * app/base.css and components/ui. No third-party component library sits
 * underneath, so there is nothing to fight over specificity or colour mode.
 *
 * A `QueryClientProvider` used to wrap these two. It wrapped nothing that used
 * it: the entire codebase contains no `useQuery`, `useMutation` or
 * `useQueryClient` — data flows through Server Components and Server Actions,
 * which is the right choice here and leaves a client-side query cache with no
 * job to do. The library was still shipped to every browser on every page, so
 * removing the provider removes the dependency with it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  )
}
