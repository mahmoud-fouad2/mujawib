import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { PortalCustomersExperience } from '@/components/portal/customers-experience'
import { num } from '@/lib/format'
import { getPortalCustomers, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'العملاء' }
export const dynamic = 'force-dynamic'

export default async function PortalCustomersPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const customers = await getPortalCustomers(workspace.id, 60)

  return (
    <>
      <PageHead title="المتصلون" sub="من اتصل بك، وكم مرة، وما الذي أنجزه في كل مرة" />

      <Section title="سجل وقائمة المتصلين" meta={`${num(customers.length)} متصل`} flush>
        <PortalCustomersExperience rows={customers} />
      </Section>
    </>
  )
}
