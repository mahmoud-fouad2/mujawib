'use client'

import * as Sentry from '@sentry/nextjs'
import { RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

/**
 * `app/error.tsx` cannot catch an error thrown by the root layout itself —
 * React error boundaries never catch an error in their own parent. This is
 * that outer boundary, required to render its own <html>/<body> because it
 * replaces the root layout entirely when it fires. Kept minimal on purpose:
 * this only renders when everything else, including the design system's own
 * layout, has already failed to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root]', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>تعذّر تحميل الصفحة.</h1>
            <p style={{ color: '#666', marginBottom: 20 }}>
              حدث خطأ غير متوقع. حاول مرة أخرى — وإن تكرر الأمر أبلغ الفريق.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
              حاول مرة أخرى
            </button>
            {error.digest ? (
              <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 16 }}>{error.digest}</p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  )
}
