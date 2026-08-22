'use client'

import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui/toast'

/* ─── the menu ───────────────────────────────────────────────────────────── */

const CloseContext = createContext<() => void>(() => {})

const MENU_WIDTH = 224
const GAP = 6
const EDGE = 8

type Placement = { top: number; left: number; width: number }

/**
 * Where the panel goes, in viewport coordinates.
 *
 * The panel is rendered into a portal on `document.body`, so it is positioned
 * against the viewport rather than the trigger's offset parent. That is the
 * whole point: every table on the console sits inside `.table-scroll`, which
 * needs `overflow-x: auto` to keep wide tables usable, and an absolutely
 * positioned child of a scroll container is clipped by it. Rows near the
 * bottom of a table lost most of their menu, and the last row lost all of it.
 *
 * Alignment follows the writing direction so the panel hangs under the
 * trigger's inner edge in both RTL and LTR, and it flips above the trigger
 * when there is more room there than below.
 */
function placeMenu(trigger: HTMLElement, panelHeight: number): Placement {
  const rect = trigger.getBoundingClientRect()
  const rtl = getComputedStyle(trigger).direction === 'rtl'
  const width = MENU_WIDTH

  // Anchor to the trigger's inner edge: right edge in RTL, left edge in LTR.
  let left = rtl ? rect.right - width : rect.left
  left = Math.min(Math.max(left, EDGE), window.innerWidth - width - EDGE)

  const below = window.innerHeight - rect.bottom - GAP
  const above = rect.top - GAP
  const flip = panelHeight > below && above > below

  const top = flip
    ? Math.max(EDGE, rect.top - GAP - panelHeight)
    : Math.min(rect.bottom + GAP, window.innerHeight - panelHeight - EDGE)

  return { top: Math.max(EDGE, top), left, width }
}

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
  const [place, setPlace] = useState<Placement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const close = useCallback(() => setOpen(false), [])

  // Measure after paint so the flip decision uses the panel's real height.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const reposition = () => {
      if (!trigger.current) return
      setPlace(placeMenu(trigger.current, panel.current?.offsetHeight ?? 0))
    }
    reposition()

    // Any scroll under the trigger moves it, so follow it rather than letting
    // the panel drift away from the row it belongs to.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (trigger.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="row-actions">
      <button
        type="button"
        ref={trigger}
        className="row-actions__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panel}
              className="row-actions__menu"
              id={panelId}
              style={{
                top: place?.top ?? 0,
                left: place?.left ?? 0,
                width: place?.width ?? MENU_WIDTH,
                // Hidden for the first frame only, while the height is unknown
                // and the flip decision has not been made yet.
                visibility: place ? 'visible' : 'hidden',
              }}
            >
              <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/**
 * One item. Give it `href` to navigate or `onClick` to act — never both.
 *
 * The navigating form renders a real anchor rather than a link nested inside a
 * button. That nesting is invalid HTML: the browser flattens it, so the item
 * was announced as a button, could not be opened in a new tab, and in some
 * rows did not navigate at all.
 *
 * A disabled item keeps its `title` so the reason it cannot be used is
 * readable, rather than presenting a dead control with no explanation.
 */
export function RowAction({
  children,
  onClick,
  href,
  icon,
  tone,
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: (() => void) | undefined
  href?: string | undefined
  icon?: ReactNode
  tone?: 'danger' | undefined
  disabled?: boolean | undefined
  title?: string | undefined
}) {
  const close = useContext(CloseContext)

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className="row-actions__item"
        data-tone={tone}
        title={title}
        onClick={close}
      >
        {icon}
        <span>{children}</span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className="row-actions__item"
      data-tone={tone}
      disabled={disabled || (!onClick && !href)}
      title={title}
      onClick={() => {
        onClick?.()
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
