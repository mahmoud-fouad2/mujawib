/**
 * Charts drawn as inline SVG rather than through a charting library.
 *
 * These are small, fixed shapes — a sparkline and a daily bar series. A charting
 * dependency would add ~50 kB and a client boundary to draw forty rectangles,
 * so they stay server-rendered and weigh nothing.
 *
 * Bible §24: a chart only when it answers a question.
 */

type Point = { label: string; value: number; secondary?: number }

/* ─── sparkline ──────────────────────────────────────────────────────────── */

/**
 * Trend behind a single number. It carries no axis on purpose: its job is to
 * say "rising, falling or flat", and the exact figure sits next to it.
 */
export function Sparkline({
  points,
  tone = 'signal',
  width = 104,
  height = 28,
}: {
  points: number[]
  tone?: 'signal' | 'good' | 'warn' | 'bad'
  width?: number
  height?: number
}) {
  if (points.length < 2) return null

  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)

  const coords = points.map((v, i) => {
    const x = i * step
    // 2px inset top and bottom so the stroke is never clipped.
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return [x, y] as const
  })

  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const last = coords[coords.length - 1]
  const id = `spark-${tone}-${points.length}-${Math.round(points[0] ?? 0)}`

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="اتجاه آخر أسبوع"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`var(--${tone})`} stopOpacity="0.22" />
          <stop offset="100%" stopColor={`var(--${tone})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={`var(--${tone})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last ? <circle cx={last[0]} cy={last[1]} r="2.5" fill={`var(--${tone})`} /> : null}
    </svg>
  )
}

/* ─── daily bars ─────────────────────────────────────────────────────────── */

/**
 * Daily volume with the resolved share filled in. One question: is volume
 * holding, and how much of it closes without a person?
 */
export function DailyBars({
  points,
  fromLabel,
  toLabel,
  legend,
}: {
  points: Point[]
  fromLabel: string
  toLabel: string
  legend: { total: string; filled: string }
}) {
  const max = Math.max(1, ...points.map((p) => p.value))

  return (
    <div className="chart">
      <div className="chart__legend">
        <span className="chart__key" data-kind="filled">
          {legend.filled}
        </span>
        <span className="chart__key" data-kind="total">
          {legend.total}
        </span>
      </div>

      <div className="chart__plot" role="img" aria-label={legend.total}>
        {points.map((p) => {
          const h = (p.value / max) * 100
          const inner = p.value > 0 ? ((p.secondary ?? 0) / p.value) * 100 : 0
          return (
            <div
              key={p.label}
              className="chart__col"
              style={{ height: `${Math.max(2, h)}%` }}
              title={`${p.label} · ${p.value}`}
            >
              <i style={{ height: `${inner}%` }} />
            </div>
          )
        })}
      </div>

      <div className="chart__axis">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
    </div>
  )
}

/* ─── horizontal distribution ────────────────────────────────────────────── */

/** Ranked shares — reasons for calling, queue reasons, hour of day. */
export function ShareBars({
  rows,
  tone = 'signal',
}: {
  rows: { label: string; value: number; note?: string }[]
  tone?: 'signal' | 'good' | 'warn'
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <div className="shares">
      {rows.map((r) => (
        <div key={r.label} className="share">
          <div className="share__head">
            <span className="share__label">{r.label}</span>
            <span className="share__value mono">{r.note ?? r.value}</span>
          </div>
          <div className="share__track">
            <span
              className="share__fill"
              data-tone={tone}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── donut ──────────────────────────────────────────────────────────────── */

/**
 * A single ratio, drawn as a ring. Used for one number only — a page of pie
 * charts is exactly what Bible §24 rules out.
 */
export function Ratio({
  value,
  label,
  tone = 'good',
  size = 92,
}: {
  value: number
  label: string
  tone?: 'good' | 'warn' | 'bad' | 'signal'
  size?: number
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="ratio">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--raised)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--${tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          // Start at 12 o'clock instead of 3.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ratio__center">
        <strong className="mono">{value}%</strong>
      </div>
    </div>
  )
}
