import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  CAMPAIGN_PURPOSE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_TONE,
  CAMPAIGN_STATUSES,
  type CampaignStatus,
} from '@/lib/campaigns'
import { num, relative } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import { getCampaignsForConsole } from '@/server/data/campaigns'
import { outboundDialerStatus } from '@/server/outbound/dialer'
import { dispatchReasonLabel } from '@/server/outbound/dispatcher'

export const metadata: Metadata = { title: 'حملات الاتصال' }
export const dynamic = 'force-dynamic'

export default async function ConsoleCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  // Nav hides this group without the permission, but a hidden link is not
  // a check — the route is reachable by typing it.
  await requireOperatorPermissionPage('campaign.approve', '/console/campaigns')

  const { status } = await searchParams
  const filter = (CAMPAIGN_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as CampaignStatus)
    : undefined

  const [all, filtered] = await Promise.all([
    getCampaignsForConsole(),
    filter ? getCampaignsForConsole({ status: filter }) : Promise.resolve(null),
  ])
  const rows = filtered ?? all
  const dialer = outboundDialerStatus()

  const awaiting = all.filter((c) => c.status === 'pending_review').length
  const running = all.filter((c) => c.status === 'running').length

  return (
    <>
      <PageHead
        title="حملات الاتصال الصادر"
        sub="كل حملة يبنيها عميل تمر من هنا. العميل يبني ويرسل؛ التشغيل قرار المنصة."
      />

      {/*
        The state this deployment is actually in, stated on the page that
        would otherwise imply the opposite. A campaign can be reviewed and
        approved here today; nothing can dial until these are set.
      */}
      {!dialer.ready ? (
        <div className="notice notice--warn" role="status">
          <strong>الاتصال الصادر غير مُهيّأ على هذا الخادم.</strong>
          <p>
            المراجعة والاعتماد يعملان الآن؛ زر التشغيل معطّل حتى تُضبط:{' '}
            <code dir="ltr">{dialer.missing.join(', ')}</code>. لم يُختبر مسار الاتصال الصادر على هذا
            النشر بعد — أول حملة تُشغَّل يجب أن تكون على رقم يخصك أنت.
          </p>
        </div>
      ) : null}

      <SummaryBar
        items={[
          {
            label: 'بانتظار المراجعة',
            value: num(awaiting),
            ...(awaiting ? { tone: 'warn' as const } : {}),
          },
          {
            label: 'قيد التشغيل',
            value: num(running),
            ...(running ? { tone: 'good' as const } : {}),
          },
          { label: 'إجمالي الحملات', value: num(all.length) },
        ]}
      />

      <Section title="الحملات" meta={`${num(rows.length)} حملة`} flush>
        <div className="console-table-toolbar">
          <Link href="/console/campaigns" className="filter-chip" aria-pressed={!filter}>
            الكل ({num(all.length)})
          </Link>
          {CAMPAIGN_STATUSES.map((value) => {
            const total = all.filter((c) => c.status === value).length
            if (total === 0 && filter !== value) return null
            return (
              <Link
                key={value}
                href={`/console/campaigns?status=${value}`}
                className="filter-chip"
                aria-pressed={filter === value}
              >
                {CAMPAIGN_STATUS_LABEL[value]} ({num(total)})
              </Link>
            )
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={filter ? 'لا حملات بهذه الحالة' : 'لا حملات بعد'}
            body="تظهر هنا كل حملة اتصال صادر يبنيها أي عميل، مع مصدر القائمة والأساس القانوني ونص المكالمة."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الحملة</th>
                  <th>العميل</th>
                  <th>الغرض</th>
                  <th>الجهات</th>
                  <th>الحالة</th>
                  <th>آخر تشغيل</th>
                  <th>أُنشئت</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((campaign) => (
                  <tr key={campaign.id}>
                    <td data-label="الحملة">
                      <Link href={`/console/campaigns/${campaign.id}`}>{campaign.name}</Link>
                    </td>
                    <td data-label="العميل">{campaign.workspaceName}</td>
                    <td data-label="الغرض">
                      {campaign.purpose ? CAMPAIGN_PURPOSE_LABEL[campaign.purpose] : '—'}
                    </td>
                    <td data-label="الجهات">
                      {campaign.contactCount > 0
                        ? `${num(campaign.doneCount)} / ${num(campaign.contactCount)}`
                        : '—'}
                    </td>
                    <td data-label="الحالة">
                      <Pill tone={CAMPAIGN_STATUS_TONE[campaign.status]}>
                        {CAMPAIGN_STATUS_LABEL[campaign.status]}
                      </Pill>
                    </td>
                    <td data-label="آخر تشغيل">
                      {campaign.status === 'running'
                        ? (dispatchReasonLabel(campaign.lastDispatchReason) ?? '—')
                        : '—'}
                    </td>
                    <td data-label="أُنشئت">{relative(campaign.createdAt)}</td>
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
