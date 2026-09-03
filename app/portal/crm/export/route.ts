import { type NextRequest, NextResponse } from 'next/server'
import { CRM_SOURCE_LABEL, CRM_STATUS_LABEL, escapeCsvField } from '@/lib/format'
import { getPortalAccess } from '@/server/auth/access'
import type { CrmDateRange, CrmStatusFilter } from '@/server/data/crm'
import { getCrmCustomers } from '@/server/data/crm'

export const dynamic = 'force-dynamic'

const STATUS_VALUES = new Set(['lead', 'active', 'inactive', 'all'])
const RANGE_VALUES = new Set(['today', 'week', 'month', 'year', 'all'])

/** Quotes a field and neutralizes spreadsheet formula injection (ASVS v5.0.0-1.2.10). */
const csvField = escapeCsvField

const HEADER = [
  'الاسم',
  'الجوال',
  'البريد الإلكتروني',
  'الحالة',
  'الوسوم',
  'ملاحظات',
  'المصدر',
  'عدد المكالمات',
  'آخر اتصال',
  'أُضيف في',
]

/**
 * The download is the same data the on-screen table shows for the same
 * filters — never masked, since a CRM export exists precisely so the client
 * can take their own contacts elsewhere (a spreadsheet, another CRM later).
 */
function toCsv(rows: Awaited<ReturnType<typeof getCrmCustomers>>): string {
  const lines = [HEADER.map(csvField).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.name ?? '',
        r.phone,
        r.email ?? '',
        CRM_STATUS_LABEL[r.status] ?? r.status,
        r.tags.join(' | '),
        r.notes ?? '',
        CRM_SOURCE_LABEL[r.source] ?? r.source,
        String(r.calls),
        r.lastCallAt ? new Date(r.lastCallAt).toISOString() : '',
        new Date(r.createdAt).toISOString(),
      ]
        .map(csvField)
        .join(','),
    )
  }
  // A leading BOM so Excel opens the Arabic header and cells as UTF-8 rather
  // than guessing a legacy codepage and mangling every non-Latin cell.
  return `﻿${lines.join('\r\n')}`
}

export async function GET(request: NextRequest) {
  const access = await getPortalAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.twoFactorEnabled) {
    return NextResponse.json({ error: 'two-factor required' }, { status: 403 })
  }
  if (!access.workspace.crmEnabled) {
    return NextResponse.json({ error: 'crm not enabled' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const statusParam = params.get('status') ?? ''
  const rangeParam = params.get('range') ?? ''
  const status: CrmStatusFilter = STATUS_VALUES.has(statusParam)
    ? (statusParam as CrmStatusFilter)
    : 'all'
  const range: CrmDateRange = RANGE_VALUES.has(rangeParam) ? (rangeParam as CrmDateRange) : 'all'
  const search = params.get('q')?.trim() || undefined

  const rows = await getCrmCustomers(access.workspace.id, { search, status, range }, 10_000)
  const csv = toCsv(rows)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${access.workspace.slug}-customers-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
