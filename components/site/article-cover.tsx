import { coverArt } from '@/lib/articles'

/**
 * The cover for an article, generated from its slug.
 *
 * Drawn rather than photographed: stock imagery of a headset says nothing,
 * costs a request on every card in the list, and shifts layout while it
 * loads. This is inline SVG with no network cost, a stable hue per slug, and
 * a figure that varies so a grid does not look like one repeated tile.
 */
export function ArticleCover({ slug, height = 160 }: { slug: string; height?: number }) {
  const { hueA, hueB, figure } = coverArt(slug)
  const id = `cover-${slug.replace(/[^a-z0-9]/gi, '') || 'x'}-${figure}`

  return (
    <svg
      className="article-cover"
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      style={{ height }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hueA} 46% 32%)`} />
          <stop offset="100%" stopColor={`hsl(${hueB} 52% 20%)`} />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill={`url(#${id})`} />
      {/* A waveform, a call graph, an arc, or a grid — one per figure value. */}
      {figure === 0 ? (
        <g stroke="rgba(255,255,255,.34)" strokeWidth="2" fill="none">
          {Array.from({ length: 26 }, (_, i) => {
            const x = 20 + i * 14
            const h = 14 + Math.abs(Math.sin(i * 1.1) * 52)
            return (
              <line key={x} x1={x} y1={80 - h / 2} x2={x} y2={80 + h / 2} strokeLinecap="round" />
            )
          })}
        </g>
      ) : null}
      {figure === 1 ? (
        <g fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="2">
          <path d="M0 120 C 80 120, 90 40, 170 40 S 280 120, 400 60" />
          <path d="M0 140 C 90 140, 110 70, 200 70 S 300 130, 400 96" opacity=".6" />
          <circle cx="170" cy="40" r="5" fill="rgba(255,255,255,.5)" stroke="none" />
        </g>
      ) : null}
      {figure === 2 ? (
        <g fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2">
          {[34, 58, 82, 106].map((r) => (
            <circle key={r} cx="60" cy="80" r={r} />
          ))}
          <circle cx="60" cy="80" r="8" fill="rgba(255,255,255,.55)" stroke="none" />
        </g>
      ) : null}
      {figure === 3 ? (
        <g stroke="rgba(255,255,255,.22)" strokeWidth="1.5">
          {/* Keyed by the coordinate the line is drawn at, which is what
              actually identifies it — the index is incidental. */}
          {[0, 20, 40, 60, 80, 100, 120, 140, 160].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} />
          ))}
          {[0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="160" />
          ))}
          <rect x="120" y="40" width="160" height="80" fill="rgba(255,255,255,.16)" stroke="none" />
        </g>
      ) : null}
    </svg>
  )
}
