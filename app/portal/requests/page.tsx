import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { NewRequestButton, RequestRowActions } from '@/components/portal/portal-actions'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { canClient } from '@/lib/access'
import { CHANGE_STATUS_LABEL, num, relative } from '@/lib/format'
import { getPortalRequests, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'طلبات التعديل' }
export const dynamic = 'force-dynamic'

/** Bible §21: the client tracks a request the way they'd track an issue. */
const PIPELINE = ['requested', 'in_review', 'testing', 'scheduled', 'live'] as const

const TYPE_LABEL: Record<string, string> = {
  business_info: 'تحديث بيانات',
  new_service: 'خدمة جديدة',
  behavior: 'تعديل سلوك',
  pronunciation: 'تصحيح نطق',
  integration: 'ربط جديد',
  phone_test: 'اختبار رقم',
}

export default async function PortalRequestsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const requests = await getPortalRequests(workspace.id)
  const open = requests.filter((r) => r.status !== 'live' && r.status !== 'rejected')
  const done = requests.filter((r) => r.status === 'live')
  const canCreate = canClient(workspace.accessRole, 'request.create')
  const canCancel = canClient(workspace.accessRole, 'request.cancel')

  return (
    <>
      <PageHead
        title="طلبات التعديل"
        sub="اطلب أي تغيير، وتابع تنفيذه خطوة بخطوة حتى يصل للتشغيل"
        actions={canCreate ? <NewRequestButton workspaceId={workspace.id} /> : undefined}
      />

      <SummaryBar
        items={[
          { label: 'قيد التنفيذ', value: num(open.length), tone: open.length ? 'warn' : 'good' },
          { label: 'منفَّذ', value: num(done.length), tone: 'good' },
          { label: 'إجمالي الطلبات', value: num(requests.length) },
        ]}
      />

      <Section title="كل الطلبات" flush>
        {requests.length === 0 ? (
          <EmptyState
            title="لا طلبات بعد"
            body="اطلب تحديث بيانات، أو إضافة خدمة، أو تغيير أسلوب المكالمة — وستتابع التنفيذ هنا."
          />
        ) : (
          <div className="queue">
            {requests.map((r) => {
              const currentIndex = PIPELINE.indexOf(r.status as (typeof PIPELINE)[number])
              return (
                <div key={r.id} className="queue__row">
                  <div>
                    <div className="queue__title">{r.title}</div>
                    <div className="queue__meta">
                      <span>{TYPE_LABEL[r.type] ?? r.type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{relative(r.createdAt)}</span>
                    </div>
                    {r.status !== 'rejected' ? (
                      <div className="cr-steps">
                        {PIPELINE.map((step, i) => (
                          <span
                            key={step}
                            className="cr-step"
                            data-state={
                              i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo'
                            }
                          >
                            {CHANGE_STATUS_LABEL[step]}
                            {i < PIPELINE.length - 1 ? ' ←' : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="row" style={{ gap: 'var(--s-2)' }}>
                    <Pill
                      tone={
                        r.status === 'live'
                          ? 'good'
                          : r.status === 'rejected'
                            ? 'bad'
                            : r.status === 'scheduled'
                              ? 'signal'
                              : 'warn'
                      }
                    >
                      {CHANGE_STATUS_LABEL[r.status] ?? r.status}
                    </Pill>
                    {canCancel ? (
                      <RequestRowActions id={r.id} title={r.title} status={r.status} />
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}
