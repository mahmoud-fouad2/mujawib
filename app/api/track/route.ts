import { randomUUID } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { db } from '@/server/db'
import { siteEvent } from '@/server/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Self-hosted analytics beacon (H5) — the marketing site's own
 * page-view/CTA-click counter, called by components/site/site-analytics.tsx.
 * No cookies, no visitor id: a burst from one client_identifier just looks
 * like one visitor browsing normally, so the limit only needs to catch a
 * script hammering the endpoint, not shape real traffic.
 */
const TRACK_LIMIT = 120
const TRACK_WINDOW_MS = 60_000

const bodySchema = z.object({
  type: z.enum(['page_view', 'cta_click']),
  path: z.string().trim().min(1).max(200),
  ctaId: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(['ar', 'en']),
})

export async function POST(req: NextRequest) {
  const limited = rateLimit(`track:${clientIdentifier(req.headers)}`, TRACK_LIMIT, TRACK_WINDOW_MS)
  if (!limited.success) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await db
    .insert(siteEvent)
    .values({
      id: `sev_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
      type: parsed.data.type,
      path: parsed.data.path,
      ctaId: parsed.data.type === 'cta_click' ? (parsed.data.ctaId ?? null) : null,
      locale: parsed.data.locale,
    })
    .catch(() => null)

  return NextResponse.json({ ok: true })
}
