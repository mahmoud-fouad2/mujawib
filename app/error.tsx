'use client'

import { AppErrorState } from '@/components/ui/error-state'

export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppErrorState {...props} />
}
