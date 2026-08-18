'use client'

import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type Tone = 'success' | 'error' | 'info'

export type Toast = {
  id: number
  tone: Tone
  message: string
  /** A single reversal offered next to the message, e.g. undo a publish. */
  action?: { label: string; run: () => void }
}

type ToastApi = {
  success: (message: string, action?: Toast['action']) => void
  error: (message: string) => void
  info: (message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = { success: Check, error: AlertTriangle, info: Info }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: Tone, message: string, action?: Toast['action']) => {
      seq.current += 1
      const id = seq.current
      setItems((prev) => [...prev, { id, tone, message, ...(action ? { action } : {}) }])
      // Errors stay until dismissed; the operator needs to read them.
      if (tone !== 'error') window.setTimeout(() => dismiss(id), action ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push('success', m, a),
      error: (m) => push('error', m),
      info: (m, a) => push('info', m, a),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <div key={t.id} className="toast" data-tone={t.tone}>
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
