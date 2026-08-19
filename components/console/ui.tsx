import { AlertTriangle, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { num } from '@/lib/format'

/* ─── page header ────────────────────────────────────────────────────────── */

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string
  /** Node rather than string: detail pages put a link to the parent here. */
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="page-head__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </header>
  )
}

/* ─── status strip ───────────────────────────────────────────────────────── */

export type Signal = { key: string; label: string; tone: 'good' | 'warn' | 'bad'; note: string }

/**
 * Bible §7: the strip renders only when something is actually wrong. A row of
 * green "all systems operational" pills is noise an operator learns to ignore.
 */
export function StatusStrip({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null

  return (
    <div className="status-strip" role="status">
      {signals.map((s) => (
        <div key={s.key} className="status-signal" data-tone={s.tone}>
          {s.tone === 'bad' ? <AlertTriangle size={15} /> : <Info size={15} />}
          <strong>{s.label}</strong>
          <span>{s.note}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── metric strip ───────────────────────────────────────────────────────── */

export type Metric = {
  label: string
  value: string
  delta?: { value: number; suffix?: string } | undefined
  hint?: string | undefined
}

function deltaDir(v: number) {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}

/** Three or four numbers, once per page — never a wall of KPI cards. */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metrics">
      {metrics.map((m) => (
        <div key={m.label} className="metric">
          <span className="metric__label">{m.label}</span>
          <span className="metric__value">{m.value}</span>
          {m.delta ? (
            <span className="metric__delta" data-dir={deltaDir(m.delta.value)}>
              {m.delta.value > 0 ? '+' : ''}
              {num(m.delta.value)}
              {m.delta.suffix ?? '%'}
            </span>
          ) : m.hint ? (
            <span className="metric__delta" data-dir="flat">
              {m.hint}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/* ─── compact summary ────────────────────────────────────────────────────── */

export type SummaryItem = {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad' | undefined
}

/**
 * One line of context above a table, instead of a row of KPI cards on every
 * page. Cards are for the home screen, where the numbers *are* the content;
 * everywhere else the table is the content and the numbers are a caption.
 */
export function SummaryBar({ items, action }: { items: SummaryItem[]; action?: ReactNode }) {
  return (
    <div className="summary">
      {items.map((i) => (
        <span key={i.label} className="summary__item" data-tone={i.tone}>
          <b>{i.value}</b>
          {i.label}
        </span>
      ))}
      {action ? <span className="summary__spacer">{action}</span> : null}
    </div>
  )
}

/* ─── volume bars ────────────────────────────────────────────────────────── */

/**
 * One trend, answering one question: is call volume holding, and how much of it
 * closes without a human? Bible §24 — a chart only when it answers a question.
 */
export function VolumeBars({
  data,
  fromLabel,
  toLabel,
}: {
  data: { day: string; total: number; resolved: number }[]
  fromLabel: string
  toLabel: string
}) {
  const max = Math.max(1, ...data.map((d) => d.total))

  return (
    <>
      <div className="bars" role="img" aria-label="حجم المكالمات اليومي">
        {data.map((d) => (
          <div
            key={d.day}
            className="bars__col"
            style={{ height: `${(d.total / max) * 100}%` }}
            title={`${d.day}: ${d.total}`}
          >
            <i style={{ height: `${d.total ? (d.resolved / d.total) * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="bars__axis">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
    </>
  )
}

/* ─── section panel ──────────────────────────────────────────────────────── */

export function Section({
  title,
  meta,
  action,
  children,
  flush,
}: {
  title: string
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="table-panel">
      <header className="table-panel__head">
        <strong style={{ fontSize: 'var(--step-0)' }}>{title}</strong>
        {meta ? (
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            {meta}
          </span>
        ) : null}
        {action ? <span style={{ marginInlineStart: 'auto' }}>{action}</span> : null}
      </header>
      {flush ? children : <div style={{ padding: 'var(--s-4)' }}>{children}</div>}
    </section>
  )
}
