export type ByteRange = {
  header: string
  start: number
  end: number
  length: number
}

export function parseByteRange(value: string | null, size: number): ByteRange | null | 'invalid' {
  if (!value) return null
  if (!Number.isSafeInteger(size) || size <= 0 || value.includes(',')) return 'invalid'
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match) return 'invalid'

  const rawStart = match[1] ?? ''
  const rawEnd = match[2] ?? ''
  if (!rawStart && !rawEnd) return 'invalid'

  if (!rawStart) {
    const suffix = Number(rawEnd)
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'invalid'
    const length = Math.min(size, suffix)
    const start = size - length
    const end = size - 1
    return { header: `bytes=${start}-${end}`, start, end, length }
  }

  const start = Number(rawStart)
  const requestedEnd = rawEnd ? Number(rawEnd) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return 'invalid'
  }
  const end = Math.min(size - 1, requestedEnd)
  return { header: `bytes=${start}-${end}`, start, end, length: end - start + 1 }
}
