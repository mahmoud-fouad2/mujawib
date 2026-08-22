import type { ReactNode } from 'react'

/* ─── Status pill ────────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'signal'

export function Pill({
  children,
  tone = 'neutral',
  dot,
  live,
  className,
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  live?: boolean
  className?: string
}) {
  return (
    <span
      className={['pill', tone !== 'neutral' && `pill--${tone}`, live && 'pill--live', className]
        .filter(Boolean)
        .join(' ')}
    >
      {dot || live ? <span className="pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}
