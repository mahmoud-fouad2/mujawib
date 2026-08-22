import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead } from '@/components/console/ui'
import { PortalCallsExperience } from '@/components/portal/calls-experience'
import { num } from '@/lib/format'
import { getPortalCallDetail, getPortalCalls, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'المكالمات' }
export const dynamic = 'force-dynamic'

export default async function PortalCallsPage({
  searchParams,
}: {
  searchParams: Promise<{ call?: string }>
}) {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const params = await searchParams
  const calls = await getPortalCalls(workspace.id, 60)
  const selectedId = params.call ?? calls[0]?.id
  const selected = selectedId ? await getPortalCallDetail(workspace.id, selectedId) : null

  return (
    <>
      <PageHead
        title="المكالمات"
        sub={`${num(calls.length)} مكالمة حقيقية · اختر مكالمة لمعرفة ما حدث وما يحتاج متابعة`}
      />
      <PortalCallsExperience rows={calls} selected={selected} />
    </>
  )
}
