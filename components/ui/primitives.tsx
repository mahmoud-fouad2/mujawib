import type { ReactNode } from 'react'

/* ─── Panel ──────────────────────────────────────────────────────────────── */

export function Panel({
  children,
  className,
  flush,
}: {
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={['panel', flush && 'panel--flush', className].filter(Boolean).join(' ')}>
      {children}
    </section>
  )
}

export function PanelHead({
  title,
  meta,
  action,
}: {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="panel__head">
      <div className="stack" style={{ gap: 2 }}>
        <h2>{title}</h2>
        {meta ? (
          <span className="muted" style={{ fontSize: 'var(--step--1)' }}>
            {meta}
          </span>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['panel__body', className].filter(Boolean).join(' ')}>{children}</div>
}

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

/* ─── Data value ─────────────────────────────────────────────────────────── */

/** Numbers, durations, phone numbers — mono, tabular, bidi-isolated. */
export function Data({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['mono', className].filter(Boolean).join(' ')}>{children}</span>
}
