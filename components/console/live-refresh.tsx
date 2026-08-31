'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Pill } from '@/components/ui/primitives'

/**
 * Ten seconds, not five.
 *
 * Each tick is a full server re-render: the console layout's own queries plus
 * the live page's. Doubling the interval halves that standing load for no
 * meaningful loss — a call's state does not change usefully faster than this,
 * and the durations on screen are recomputed from `startedAt` on every render
 * regardless. The structural fix is separate database pools
 * (`server/db/index.ts`), which stops this page competing with calls at all;
 * this simply stops asking for work nobody reads.
 */
const REFRESH_INTERVAL_MS = 10_000

/**
 * Without this, a "live" page is a snapshot the instant it loads — durations
 * computed from Date.now() at request time freeze, statuses never change,
 * and nothing tells an operator watching it that it has gone stale. Pauses
 * while the tab is hidden, so a console left open in a background tab all
 * day doesn't poll the database for nothing.
 */
export function LiveRefreshIndicator() {
  const router = useRouter()

  useEffect(() => {
    let timer: number | null = null
    const tick = () => router.refresh()
    const start = () => {
      if (timer === null) timer = window.setInterval(tick, REFRESH_INTERVAL_MS)
    }
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return (
    <Pill tone="good" live>
      مباشر — يحدّث تلقائيًا
    </Pill>
  )
}
