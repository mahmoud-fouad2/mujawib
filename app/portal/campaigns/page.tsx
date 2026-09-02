import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import {
  AddSuppression,
  NewCampaign,
  SuppressionRowActions,
} from '@/components/portal/campaign-workbench'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { canClient } from '@/lib/access'
import {
  CAMPAIGN_PURPOSE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_TONE,
} from '@/lib/campaigns'
import { num, relative } from '@/lib/format'
import {
  getCampaignsForWorkspace,
  getCampaignTargets,
  getSuppressionList,
} from '@/server/data/campaigns'
import { getPortalWorkspace } from '@/server/data/portal'
import { outboundDialerStatus } from '@/server/outbound/dialer'

export const metadata: Metadata = { title: 'حملات الاتصال' }
export const dynamic = 'force-dynamic'

export default async function PortalCampaignsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const canManage = canClient(workspace.accessRole, 'campaign.manage')
  const [campaigns, suppression, targets] = await Promise.all([
    getCampaignsForWorkspace(workspace.id),
    getSuppressionList(workspace.id),
    getCampaignTargets(workspace.id),
  ])
  const dialer = outboundDialerStatus()

  const running = campaigns.filter((c) => c.status === 'running').length
  const awaiting = campaigns.filter((c) => c.status === 'pending_review').length

  const versionOptions = targets.versions.map((v) => ({
    id: v.id,
    label: `${v.agentName} — نسخة ${v.versionNumber}`,
  }))
  const numberOptions = targets.numbers.map((n) => ({
    id: n.id,
    label: n.label ? `${n.e164} — ${n.label}` : n.e164,
  }))

  return (
    <>
      <PageHead
        title="حملات الاتصال الصادر"
        sub="ترفع القائمة وتكتب التعليمات وتحدد الأوقات — ولا تبدأ أي مكالمة قبل اعتماد الفريق."
        actions={
          canManage ? (
            <>
              <AddSuppression workspaceId={workspace.id} />
              <NewCampaign
                workspaceId={workspace.id}
                versions={versionOptions}
                numbers={numberOptions}
              />
            </>
          ) : null
        }
      />

      {/*
        Stated, not hidden. A feature that looks enabled and silently never
        dials is worse than one that says it is off — the first costs a client
        a day of waiting before they ask.
      */}
      {!dialer.ready ? (
        <div className="notice notice--warn" role="status">
          <strong>الاتصال الصادر غير مُفعَّل على هذا الخادم بعد.</strong>
          <p>
            يمكنك بناء الحملة بالكامل ورفع القائمة وإرسالها للمراجعة، ولن تُجرى أي مكالمة حتى يُفعَّل
            المزوّد. تواصل مع فريق مُجاوِب لتفعيله.
          </p>
        </div>
      ) : null}

      <SummaryBar
        items={[
          {
            label: 'حملة قيد التشغيل',
            value: num(running),
            ...(running ? { tone: 'good' as const } : {}),
          },
          {
            label: 'بانتظار المراجعة',
            value: num(awaiting),
            ...(awaiting ? { tone: 'warn' as const } : {}),
          },
          { label: 'أرقام محظورة', value: num(suppression.length) },
        ]}
      />

      <Section title="الحملات" flush>
        {campaigns.length === 0 ? (
          <EmptyState
            title="لا حملات بعد"
            body="الحملة الصادرة تتصل بعملائك الحاليين للمتابعة أو التذكير. ابدأ بمسودة، ارفع القائمة، ثم أرسلها للمراجعة."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الحملة</th>
                  <th>الغرض</th>
                  <th>الجهات</th>
                  <th>التقدم</th>
                  <th>الحالة</th>
                  <th>أُنشئت</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td data-label="الحملة">
                      <Link href={`/portal/campaigns/${campaign.id}`}>{campaign.name}</Link>
                    </td>
                    <td data-label="الغرض">
                      {campaign.purpose ? CAMPAIGN_PURPOSE_LABEL[campaign.purpose] : '—'}
                    </td>
                    <td data-label="الجهات">{num(campaign.contactCount)}</td>
                    <td data-label="التقدم">
                      {campaign.contactCount > 0
                        ? `${num(campaign.doneCount)} / ${num(campaign.contactCount)}`
                        : '—'}
                    </td>
                    <td data-label="الحالة">
                      <Pill tone={CAMPAIGN_STATUS_TONE[campaign.status]}>
                        {CAMPAIGN_STATUS_LABEL[campaign.status]}
                      </Pill>
                    </td>
                    <td data-label="أُنشئت">{relative(campaign.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="قائمة الحظر" meta={`${num(suppression.length)} رقم`} flush>
        {suppression.length === 0 ? (
          <EmptyState
            title="لا أرقام محظورة"
            body="أي رقم تضيفه هنا يُلغى فورًا من كل حملة مجدولة ولا يُقبل في أي رفع لاحق. الحظر بلا تاريخ انتهاء."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>السبب</th>
                  <th>أُضيف</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {suppression.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="الرقم" dir="ltr">
                      {entry.phone}
                    </td>
                    <td data-label="السبب">{entry.reason ?? '—'}</td>
                    <td data-label="أُضيف">{relative(entry.createdAt)}</td>
                    <td data-label="إجراءات">
                      {canManage ? (
                        <SuppressionRowActions entryId={entry.id} workspaceId={workspace.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
