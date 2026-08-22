'use client'

import { MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useToast } from '@/components/ui/toast'

/* ─── the menu ───────────────────────────────────────────────────────────── */

const CloseContext = createContext<() => void>(() => {})

/**
 * A disclosure of real buttons rather than an ARIA menu widget. The items are
 * already focusable and announced correctly, and there is no roving-tabindex
 * contract to get subtly wrong.
 */
export function RowActions({
  children,
  label = 'إجراءات',
}: {
  children: ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="row-actions" ref={wrap}>
      <button
        type="button"
        className="row-actions__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="row-actions__menu" id={panelId}>
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
        </div>
      ) : null}
    </div>
  )
}

export function RowAction({
  children,
  onClick,
  icon,
  tone,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  icon?: ReactNode
  tone?: 'danger' | undefined
  disabled?: boolean | undefined
  title?: string | undefined
}) {
  const close = useContext(CloseContext)

  return (
    <button
      type="button"
      className="row-actions__item"
      data-tone={tone}
      disabled={disabled}
      title={title}
      onClick={() => {
        onClick()
        close()
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function RowActionSeparator() {
  // <hr> carries the separator semantics natively — no ARIA role needed.
  return <hr className="row-actions__sep" />
}

/* ─── running a server action ────────────────────────────────────────────── */

type Result = { ok: true; message: string } | { ok: false; error: string; refresh?: boolean }

/**
 * One place where every server action is invoked, so success and failure are
 * reported the same way everywhere and the view refreshes from the database
 * rather than from optimistic local state.
 */
export function useAction() {
  const [pending, startTransition] = useTransition()
  const toast = useToast()
  const router = useRouter()

  function run(fn: () => Promise<Result>, onSuccess?: () => void) {
    startTransition(async () => {
      let progressToast: number | null = null
      const progressTimer = window.setTimeout(() => {
        progressToast = toast.info('جارٍ تنفيذ الإجراء…')
      }, 450)

      try {
        const result = await fn()
        window.clearTimeout(progressTimer)
        if (progressToast) toast.dismiss(progressToast)
        if (result.ok) {
          toast.success(result.message)
          onSuccess?.()
          router.refresh()
        } else {
          toast.error(result.error)
          if (result.refresh) router.refresh()
        }
      } catch {
        window.clearTimeout(progressTimer)
        if (progressToast) toast.dismiss(progressToast)
        toast.error('تعذر تنفيذ الإجراء. تحقق من الاتصال وحاول مرة أخرى.')
      }
    })
  }

  return { run, pending }
}
