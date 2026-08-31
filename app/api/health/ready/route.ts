import { NextResponse } from 'next/server'
import { readinessReport } from '@/server/runtime/health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Readiness — dependencies, configuration, and whether this process is still
 * accepting work. 503 here means "do not send traffic", never "restart me".
 */
export async function GET() {
  const report = await readinessReport()
  return NextResponse.json(report, {
    status: report.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
