const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Periodically prune expired entries to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000).unref()
}

/**
 * In-memory fixed window rate limiter.
 * Ideal for a single Node.js instance (e.g. Render) without requiring Redis.
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetAt })
    return { success: true, remaining: limit - 1, resetAt }
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count += 1
  return { success: true, remaining: limit - record.count, resetAt: record.resetAt }
}

/**
 * Best-effort caller identity from proxy headers.
 *
 * Reads the *last* entry of `X-Forwarded-For`, not the first. This runs
 * behind exactly one hop — Render's own edge — and a single trusted proxy
 * appends the address it actually observed to whatever arrived with the
 * request; it does not overwrite what the client sent. Reading the first
 * entry took the client's own, freely-typed value instead of Render's,
 * which made the limiter trivially bypassable: a request with
 * `X-Forwarded-For: 1.2.3.4` picked a fresh bucket on every retry.
 *
 * Still best-effort. Behind more than one hop this would need the count of
 * trusted proxies to know how many entries from the end to trust — this
 * deployment has exactly one, so "last" is that hop.
 */
export function clientIdentifier(headers: { get(name: string): string | null }): string {
  const chain = headers.get('x-forwarded-for')
  const forwarded = chain
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)
  return forwarded || headers.get('x-real-ip') || 'unknown'
}
