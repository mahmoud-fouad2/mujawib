import type { Metadata } from 'next'
import { CallsWorkbench } from '@/components/console/calls-workbench'
import { PageHead } from '@/components/console/ui'
import { canOperator } from '@/lib/access'
import { num } from '@/lib/format'
import { requireOperatorPage } from '@/server/auth/access'
import { type CallFilter, getCallDetail, getCalls, getClientBySlug } from '@/server/data/console'

export const metadata: Metadata = { title: 'المكالمات' }
export const dynamic = 'force-dynamic'

const VALID: CallFilter[] = ['all', 'needs_review', 'resolved', 'transferred', 'failed', 'demo']
const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string
    q?: string
    call?: string
    client?: string
    range?: string
  }>
}) {
  const [params, access] = await Promise.all([searchParams, requireOperatorPage('/console/calls')])
  const filter = (VALID.includes(params.filter as CallFilter) ? params.filter : 'all') as CallFilter
  const search = params.q?.trim() || undefined
  const range = Object.hasOwn(RANGE_DAYS, params.range ?? '') ? (params.range ?? 'all') : 'all'
  const cutoffDays = RANGE_DAYS[range]
  const client = params.client ? await getClientBySlug(params.client) : null

  const rows = await getCalls({
    filter,
    ...(search ? { search } : {}),
    ...(cutoffDays ? { since: new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000) } : {}),
    ...(client ? { workspaceId: client.id } : {}),
    limit: 80,
  })
  // Default to the first row so the workbench is never a blank right-hand side.
  const selectedId = params.call ?? rows[0]?.id
  const selected = selectedId ? await getCallDetail(selectedId) : null

  return (
    <>
      <PageHead
        title="المكالمات"
        sub={
          client
            ? `${num(rows.length)} مكالمة لـ${client.name} · اختر واحدة لعرض الحوار والنتيجة`
            : `${num(rows.length)} مكالمة معروضة · اختر واحدة لعرض الحوار والنتيجة`
        }
      />
      <CallsWorkbench
        rows={rows}
        selected={selected}
        filter={filter}
        range={range}
        {...(params.client ? { clientSlug: params.client } : {})}
        canRetrySummary={canOperator(access.role, 'qa.review')}
        {...(search ? { search } : {})}
      />
    </>
  )
}
