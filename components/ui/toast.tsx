'use client'

import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type Tone = 'success' | 'error' | 'info'

export type Toast = {
  id: number
  tone: Tone
  message: string
  /** A single reversal offered next to the message, e.g. undo a publish. */
  action?: { label: string; run: () => void }
}

type ToastApi = {
  success: (message: string, action?: Toast['action']) => number
  error: (message: string) => number
  info: (message: string, action?: Toast['action']) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi>({
  success: () => 0,
  error: () => 0,
  info: () => 0,
  dismiss: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = { success: Check, error: AlertTriangle, info: Info }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)
  const timers = useRef(new Set<number>())

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    },
    [],
  )

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: Tone, message: string, action?: Toast['action']) => {
      seq.current += 1
      const id = seq.current
      setItems((prev) => [
        ...prev.filter((item) => item.message !== message || item.tone !== tone).slice(-3),
        { id, tone, message, ...(action ? { action } : {}) },
      ])
      const timer = window.setTimeout(
        () => {
          dismiss(id)
          timers.current.delete(timer)
        },
        tone === 'error' ? 10_000 : action ? 8000 : 4500,
      )
      timers.current.add(timer)
      return id
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push('success', m, a),
      error: (m) => push('error', m),
      info: (m, a) => push('info', m, a),
      dismiss,
    }),
    [dismiss, push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions removals">
        {items.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <div
              key={t.id}
              className="toast"
              data-tone={t.tone}
              role={t.tone === 'error' ? 'alert' : 'status'}
              aria-atomic="true"
            >
              <Icon size={16} aria-hidden="true" />
              <span className="toast__msg">{t.message}</span>
              {t.action ? (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    t.action?.run()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(t.id)}
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
