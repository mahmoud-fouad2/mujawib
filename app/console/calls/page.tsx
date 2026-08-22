import type { Metadata } from 'next'
import { CallsWorkbench } from '@/components/console/calls-workbench'
import { PageHead } from '@/components/console/ui'
import { canOperator } from '@/lib/access'
import { num } from '@/lib/format'
import { requireOperatorPage } from '@/server/auth/access'
import { type CallFilter, getCallDetail, getCalls } from '@/server/data/console'

export const metadata: Metadata = { title: 'المكالمات' }
export const dynamic = 'force-dynamic'

const VALID: CallFilter[] = ['all', 'needs_review', 'resolved', 'transferred', 'failed', 'demo']

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; call?: string }>
}) {
  const params = await searchParams
  const access = await requireOperatorPage('/console/calls')
  const filter = (VALID.includes(params.filter as CallFilter) ? params.filter : 'all') as CallFilter
  const search = params.q?.trim() || undefined

  const rows = await getCalls({ filter, ...(search ? { search } : {}), limit: 80 })
  // Default to the first row so the workbench is never a blank right-hand side.
  const selectedId = params.call ?? rows[0]?.id
  const selected = selectedId ? await getCallDetail(selectedId) : null

  return (
    <>
      <PageHead
        title="المكالمات"
        sub={`${num(rows.length)} مكالمة معروضة · اختر واحدة لعرض الحوار والنتيجة`}
      />
      <CallsWorkbench
        rows={rows}
        selected={selected}
        filter={filter}
        canRetrySummary={canOperator(access.role, 'qa.review')}
        {...(search ? { search } : {})}
      />
    </>
  )
}
