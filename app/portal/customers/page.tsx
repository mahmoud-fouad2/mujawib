import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { CrmTable } from '@/components/portal/crm-table'
import { PortalCustomersExperience } from '@/components/portal/customers-experience'
import { canClient } from '@/lib/access'
import { num } from '@/lib/format'
import type { CrmDateRange, CrmStatusFilter } from '@/server/data/crm'
import { getCrmCustomers, getCrmSummary } from '@/server/data/crm'
import { getPortalCustomers, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'العملاء' }
export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; status?: string; range?: string }

const STATUS_VALUES = new Set(['lead', 'active', 'inactive', 'all'])
const RANGE_VALUES = new Set(['today', 'week', 'month', 'year', 'all'])

export default async function PortalCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  // The CRM table (search, tags, notes, CSV export) is a packaging upgrade an
  // operator turns on per client from `/console/clients/[slug]`. Everyone
  // else keeps the read-only caller list that already worked — enabling CRM
  // for one client must never take the customers page away from another.
  if (!workspace.crmEnabled) {
    const { rows: customers, total } = await getPortalCustomers(workspace.id, 60)
    const meta =
      total > customers.length
        ? `${num(customers.length)} من ${num(total)} متصل`
        : `${num(total)} متصل`
    return (
      <>
        <PageHead title="المتصلون" sub="من اتصل بك، وكم مرة، وما الذي أنجزه في كل مرة" />
        <Section title="سجل وقائمة المتصلين" meta={meta} flush>
          <PortalCustomersExperience rows={customers} />
        </Section>
      </>
    )
  }

  const params = await searchParams
  const status: CrmStatusFilter = STATUS_VALUES.has(params.status ?? '')
    ? (params.status as CrmStatusFilter)
    : 'all'
  const range: CrmDateRange = RANGE_VALUES.has(params.range ?? '')
    ? (params.range as CrmDateRange)
    : 'all'
  const search = params.q?.trim() || undefined

  const [customers, summary] = await Promise.all([
    getCrmCustomers(workspace.id, { search, status, range }),
    getCrmSummary(workspace.id),
  ])
  const canManage = canClient(workspace.accessRole, 'crm.manage')

  return (
    <>
      <PageHead title="العملاء" sub="من تواصل معك، من أضفته يدويًا، وحالة كل جهة اتصال." />
      <CrmTable
        workspaceId={workspace.id}
        customers={customers}
        summary={summary}
        filters={{ search: search ?? '', status, range }}
        canManage={canManage}
      />
    </>
  )
}
