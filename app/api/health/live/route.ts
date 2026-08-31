import { NextResponse } from 'next/server'
import { livenessReport } from '@/server/runtime/health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Liveness — what `render.yaml`'s `healthCheckPath` points at.
 *
 * Touches nothing off-process on purpose. If this handler runs at all, the
 * process is healthy enough to keep, and restarting it would only sever the
 * control channel of every call currently on the line. Dependency state
 * belongs to `/api/health/ready`, which is the one to read when deciding
 * whether to send traffic here.
 *
 * Answers 200 while draining too: a draining process is finishing real calls
 * and must not be restarted out from under them.
 */
export function GET() {
  return NextResponse.json(livenessReport(), {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
