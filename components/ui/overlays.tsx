'use client'

import { X } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Escape to close, focus moved in on open, focus restored on close.
 *
 * `initialFocusSelector` picks what receives focus on open — the default
 * suits Sheet/Confirm, whose content is form fields and buttons. A caller
 * whose content is mostly navigation links (nothing a form-field selector
 * would ever match) can override it.
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  initialFocusSelector = 'input, textarea, select, button:not([data-dismiss])',
) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  // Read through a ref rather than depending on onClose directly: callers
  // pass a fresh inline closure on every render, and this effect must not
  // re-run on every keystroke inside the overlay — it did, and each re-run
  // yanked focus back to the close button (see the querySelector below).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !ref.current) return

      // Keep Tab inside the overlay while it is open.
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      // Excludes [data-dismiss] in the default selector: Sheet's header close
      // button sits before the body in DOM order, so the untargeted selector
      // focused it instead of the first real field every time this ran.
      ref.current?.querySelector<HTMLElement>(initialFocusSelector)?.focus()
    })

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      restoreTo.current?.focus()
    }
  }, [open, initialFocusSelector])

  return ref
}

/* ─── Sheet ──────────────────────────────────────────────────────────────── */

/**
 * Edit surface that slides in beside the list. Editing in place keeps the
 * operator's position in the queue — a full page navigation loses it.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useDismissable(open, onClose)
  if (!open) return null

  return (
    <div className="overlay">
      <button type="button" className="overlay__scrim" aria-label="إغلاق" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="sheet__head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="إغلاق"
            data-dismiss
          >
            <X size={18} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

/* ─── Confirm ────────────────────────────────────────────────────────────── */

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = 'default',
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  pending?: boolean
}) {
  const ref = useDismissable(open, onClose)
  if (!open) return null

  return (
    <div className="overlay overlay--center">
      <button type="button" className="overlay__scrim" aria-label="إلغاء" onClick={onClose} />
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="confirm__actions">
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'جارٍ التنفيذ…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
