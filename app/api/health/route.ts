import { NextResponse } from 'next/server'
import { readinessReport } from '@/server/runtime/health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Kept at its original path and original meaning so anything already pointed
 * here — a dashboard, an uptime check, a runbook — keeps working. The split
 * that matters is that `render.yaml` now health-checks `/api/health/live`
 * instead of this, so a transient database blip can no longer be read by the
 * platform as a reason to restart a container carrying live calls.
 */
export async function GET() {
  const report = await readinessReport()
  return NextResponse.json(
    {
      status: report.status,
      service: 'mujawib-web',
      revision: report.revision,
      checks: report.checks,
      timestamp: report.timestamp,
    },
    { status: report.ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
