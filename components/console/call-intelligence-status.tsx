'use client'

import { LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAction } from '@/components/ui/row-actions'
import type { CallIntelligenceView } from '@/lib/call-intelligence'
import { retryCallSummary } from '@/server/actions/calls'

export function CallIntelligenceStatus({
  callId,
  state,
  canProcess,
  stale = false,
}: {
  callId: string
  state: CallIntelligenceView
  canProcess: boolean
  stale?: boolean
}) {
  const router = useRouter()
  const { run, pending } = useAction()

  useEffect(() => {
    if (state.state !== 'processing' || stale) return
    const timer = window.setTimeout(() => router.refresh(), 2500)
    return () => window.clearTimeout(timer)
  }, [router, stale, state.state])

  if (state.state === 'completed') {
    return (
      <span className="call-intelligence-state" data-state="completed">
        <Sparkles size={14} aria-hidden="true" />
        ملخص جاهز
      </span>
    )
  }

  if ((state.state === 'processing' && !stale) || pending) {
    return (
      <span className="call-intelligence-state" data-state="processing" aria-live="polite">
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
        نجهز الملخص…
      </span>
    )
  }

  if (state.state === 'skipped' && state.reason === 'missing_transcript') {
    return <span className="call-intelligence-state">ينتظر نص الحوار</span>
  }

  if (!canProcess) return null

  return (
    <Button
      variant="quiet"
      size="sm"
      leading={<RefreshCw size={14} aria-hidden="true" />}
      onClick={() => run(() => retryCallSummary(callId))}
    >
      {state.state === 'failed' || state.state === 'processing' ? 'أعد المحاولة' : 'جهّز الملخص'}
    </Button>
  )
}
