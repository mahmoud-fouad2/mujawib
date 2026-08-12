type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: boolean
  strokeWidth?: number
}

/**
 * Minimal SVG sparkline. Stroke defaults to the accent token; the optional
 * area fill uses a low-opacity accent so it reads as a subtle trend, not decoration.
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = 'var(--fgColor-accent)',
  fill = true,
  strokeWidth = 1.75,
}: SparklineProps) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pad = strokeWidth
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {fill ? <path d={area} fill={stroke} opacity={0.1} /> : null}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
