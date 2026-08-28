'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Catches a failed render — most often a database round trip that timed out.
 * Without this the route returns a blank 500; here the reader gets an
 * explanation and a retry that re-runs the server component.
 *
 * Shared by every route-level `error.tsx` (root, console, portal) — they were
 * three byte-identical copies of this same boundary.
 */
export function AppErrorState({
  error,
  reset,
  homeHref = '/',
}: {
  error: Error & { digest?: string }
  reset: () => void
  homeHref?: string
}) {
  useEffect(() => {
    console.error('[render]', error)
  }, [error])

  return (
    <div className="notfound">
      <p className="label">خطأ مؤقت</p>
      <h1>تعذّر تحميل هذه الصفحة.</h1>
      <p className="notfound__lead">
        غالبًا انقطاع لحظي في الاتصال بقاعدة البيانات. حاول مرة أخرى — وإن تكرر الأمر أبلغ الفريق.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn--primary" onClick={reset}>
          <RotateCcw size={15} aria-hidden="true" />
          حاول مرة أخرى
        </button>
        <Link href={homeHref} className="btn">
          الصفحة الرئيسية
        </Link>
      </div>
      {error.digest ? (
        <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          {error.digest}
        </p>
      ) : null}
    </div>
  )
}
