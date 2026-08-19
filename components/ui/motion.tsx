'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

/* ─── counter ────────────────────────────────────────────────────────────── */

/**
 * Counts up once, when the number first scrolls into view.
 *
 * Deliberately hand-rolled rather than pulling an animation library: this is
 * ~40 lines against ~30 kB, and it degrades to the final value if the browser
 * has no IntersectionObserver or the reader prefers reduced motion.
 */
export function Counter({
  value,
  duration = 1100,
  format,
  suffix,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const done = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(value)
      return
    }

    setShown(0)

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || done.current) return
        done.current = true
        observer.disconnect()

        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          // easeOutExpo — fast to settle, so the number is readable early.
          const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t)
          setShown(Math.round(value * eased))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className="counter">
      {format ? format(shown) : shown}
      {suffix}
    </span>
  )
}

/* ─── marquee ────────────────────────────────────────────────────────────── */

/**
 * Renders its children twice so the CSS loop has an identical second copy to
 * translate into. The clone is hidden from assistive tech and from the
 * reduced-motion layout.
 */
export function Marquee({
  children,
  duration = 38,
  reverse,
}: {
  children: ReactNode
  duration?: number
  reverse?: boolean
}) {
  return (
    <div
      className={`marquee${reverse ? ' marquee--reverse' : ''}`}
      style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className="marquee__track">
        <div className="marquee__set">{children}</div>
        <div className="marquee__set" data-marquee-clone="true" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── live equaliser ─────────────────────────────────────────────────────── */

export function Equaliser({ bars = 5, className }: { bars?: number; className?: string }) {
  return (
    <span className={['eq', className].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        // Fixed-length decorative bars; position is their only identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: static decorative list
        <i key={i} style={{ animationDelay: `${i * 110}ms` }} />
      ))}
    </span>
  )
}
