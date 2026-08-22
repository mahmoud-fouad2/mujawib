const INTERNAL_ORIGIN = 'https://internal.mujawib.invalid'

/** Returns a normalized same-origin path or the supplied fallback. */
export function safeInternalPath<T extends string | null>(
  value: string | null | undefined,
  fallback: T,
): string | T {
  if (!value?.startsWith('/')) return fallback

  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()
  const hasControlCharacters = [...decoded].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
  if (value.includes('\\') || decoded.includes('\\') || hasControlCharacters) {
    return fallback
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
