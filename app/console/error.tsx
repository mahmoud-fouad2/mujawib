'use client'

import { AppErrorState } from '@/components/ui/error-state'

export default function ConsoleError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <AppErrorState {...props} homeHref="/console" />
}
