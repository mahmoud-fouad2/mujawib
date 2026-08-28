'use client'

import { AppErrorState } from '@/components/ui/error-state'

export default function PortalError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <AppErrorState {...props} homeHref="/portal" />
}
