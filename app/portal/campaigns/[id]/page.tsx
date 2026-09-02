import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import {
  ClearContacts,
  EditCampaign,
  RetryContact,
  RunStateControls,
  SubmitForReview,
  UploadContacts,
  WithdrawCampaign,
} from '@/components/portal/campaign-workbench'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { canClient } from '@/lib/access'
import {
  CAMPAIGN_PURPOSE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  type CampaignContactStatus,
  CONSENT_BASIS_LABEL,
  CONTACT_STATUS_LABEL,
  campaignReadiness,
  isReadyToSubmit,
  isWithinCallingWindow,
  minuteToTime,
  nextWindowOpening,
  WEEKDAY_LABEL,
} from '@/lib/campaigns'
import { fullDate, num, relative } from '@/lib/format'
import {
  getCampaignContacts,
  getCampaignDetail,
  getCampaignTargets,
  getContactStatusCounts,
} from '@/server/data/campaigns'
import { getPortalWorkspace } from '@/server/data/portal'
import { outboundDialerStatus } from '@/server/outbound/dialer'
import { dispatchReasonLabel } from '@/server/outbound/dispatcher'

export const metadata: Metadata = { title: 'الحملة' }
export const dynamic = 'force-dynamic'

const EDITABLE = new Set(['draft', 'pending_review', 'rejected'])
const RETRYABLE = new Set<CampaignContactStatus>(['no_answer', 'busy', 'failed'])

export default async function PortalCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const { id } = await params
  const { status: statusFilter } = await searchParams
  const campaign = await getCampaignDetail(id, workspace.id)
  if (!campaign) notFound()

  const filter =
    statusFilter && statusFilter in CONTACT_STATUS_LABEL
      ? (statusFilter as CampaignContactStatus)
      : undefined

  const [contacts, counts, targets] = await Promise.all([
    getCampaignContacts(campaign.id, filter ? { status: filter } : {}),
    getContactStatusCounts(campaign.id),
    getCampaignTargets(workspace.id),
  ])

  const canManage = canClient(workspace.accessRole, 'campaign.manage')
  const editable = EDITABLE.has(campaign.status)
  const dialer = outboundDialerStatus()
  const now = new Date()

  const problems = campaignReadiness({
    name: campaign.name,
    purpose: campaign.purpose,
    consentBasis: campaign.consentBasis,
    agentVersionId: campaign.agentVersionId,
    fromNumberId: campaign.fromNumberId,
    contactCount: campaign.contactCount,
    script: campaign.script,
    forbiddenClaims: campaign.forbiddenClaims,
    // Readiness here is about the campaign, not the server: it can be
    // completed and submitted on a deployment that cannot dial yet.
    dialerReady: true,
  })

  const windowOpen = isWithinCallingWindow(now, campaign.window)
  const opensAt = windowOpen ? null : nextWindowOpening(now, campaign.window)
  const reason = dispatchReasonLabel(campaign.lastDispatchReason)

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
        title={campaign.name}
        sub={
          <Link href="/portal/campaigns" className="detail-back">
            ← كل الحملات
          </Link>
        }
        actions={
          canManage ? (
            <>
              {editable ? (
                <EditCampaign
                  workspaceId={workspace.id}
                  versions={versionOptions}
                  numbers={numberOptions}
                  row={{
                    id: campaign.id,
                    name: campaign.name,
                    purpose: campaign.purpose,
                    consentBasis: campaign.consentBasis,
                    consentNote: campaign.consentNote,
                    agentVersionId: campaign.agentVersionId,
                    fromNumberId: campaign.fromNumberId,
                    script: campaign.script,
                    forbiddenClaims: campaign.forbiddenClaims,
                    windowStartMinute: campaign.window.startMinute,
                    windowEndMinute: campaign.window.endMinute,
                    windowDays: campaign.window.activeDays,
                    utcOffsetMinutes: campaign.window.utcOffsetMinutes,
                    initialConcurrency: campaign.pacing.initialConcurrency,
                    maxConcurrency: campaign.pacing.maxConcurrency,
                    rampMinutes: campaign.pacing.rampMinutes,
                    dailyCap: campaign.dailyCap,
                  }}
                />
              ) : null}
              {campaign.status === 'draft' || campaign.status === 'rejected' ? (
                <SubmitForReview
                  campaignId={campaign.id}
                  workspaceId={workspace.id}
                  ready={isReadyToSubmit(problems)}
                />
              ) : null}
              {campaign.status === 'pending_review' || campaign.status === 'approved' ? (
                <WithdrawCampaign campaignId={campaign.id} workspaceId={workspace.id} />
              ) : null}
              <RunStateControls
                campaignId={campaign.id}
                workspaceId={workspace.id}
                status={campaign.status}
              />
            </>
          ) : null
        }
      />

      {campaign.status === 'rejected' && campaign.reviewNote ? (
        <div className="notice notice--bad" role="status">
          <strong>رُفضت الحملة</strong>
          <p>{campaign.reviewNote}</p>
        </div>
      ) : null}

      {campaign.status === 'running' && reason && campaign.lastDispatchReason !== 'ok' ? (
        <div className="notice notice--warn" role="status">
          <strong>الحملة تعمل لكنها لا تتصل الآن</strong>
          <p>
            {reason}
            {opensAt ? ` — تستأنف ${fullDate(opensAt)}` : ''}
          </p>
        </div>
      ) : null}

      {!dialer.ready ? (
        <div className="notice notice--warn" role="status">
          <strong>الاتصال الصادر غير مُفعَّل على هذا الخادم.</strong>
          <p>كل ما في هذه الصفحة قابل للإعداد والمراجعة، ولن تُجرى مكالمة حتى يُفعَّل المزوّد.</p>
        </div>
      ) : null}

      {problems.length > 0 && editable ? (
        <div className="notice" role="status">
          <strong>ما ينقص قبل الإرسال</strong>
          <ul>
            {problems.map((problem) => (
              <li key={problem.field}>
                {problem.blocking ? '• ' : '○ '}
                {problem.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SummaryBar
        items={[
          { label: 'الحالة', value: CAMPAIGN_STATUS_LABEL[campaign.status] },
          { label: 'الجهات', value: num(campaign.contactCount) },
          { label: 'أُنجزت', value: num(campaign.doneCount) },
          {
            label: 'نافذة الاتصال',
            value: windowOpen ? 'مفتوحة' : 'مغلقة',
            ...(windowOpen ? { tone: 'good' as const } : {}),
          },
        ]}
      />

      <Section title="إعدادات الحملة">
        <ul className="stat-list">
          <li>
            <span>الغرض</span>
            <strong>{campaign.purpose ? CAMPAIGN_PURPOSE_LABEL[campaign.purpose] : '—'}</strong>
          </li>
          <li>
            <span>الأساس القانوني</span>
            <strong>
              {campaign.consentBasis ? CONSENT_BASIS_LABEL[campaign.consentBasis] : '—'}
            </strong>
          </li>
          <li>
            <span>الموظف الصوتي</span>
            <strong>
              {campaign.agentName
                ? `${campaign.agentName} — نسخة ${campaign.agentVersionNumber}`
                : '—'}
            </strong>
          </li>
          <li>
            <span>الرقم الصادر</span>
            <strong dir="ltr">{campaign.fromNumberE164 ?? '—'}</strong>
          </li>
          <li>
            <span>أيام الاتصال</span>
            <strong>
              {campaign.window.activeDays.map((d) => WEEKDAY_LABEL[d]).join('، ') || '—'}
            </strong>
          </li>
          <li>
            <span>ساعات الاتصال</span>
            <strong dir="ltr">
              {minuteToTime(campaign.window.startMinute)} –{' '}
              {minuteToTime(campaign.window.endMinute)}
            </strong>
          </li>
          <li>
            <span>الحد اليومي</span>
            <strong>{num(campaign.dailyCap)}</strong>
          </li>
          <li>
            <span>أقصى مكالمات متزامنة</span>
            <strong>{num(campaign.pacing.maxConcurrency)}</strong>
          </li>
        </ul>

        {campaign.script ? (
          <>
            <div className="detail-section-label">تعليمات المكالمة</div>
            <p className="card-sub">{campaign.script}</p>
          </>
        ) : null}
        {campaign.forbiddenClaims ? (
          <>
            <div className="detail-section-label">ممنوع قوله</div>
            <p className="card-sub">{campaign.forbiddenClaims}</p>
          </>
        ) : null}
      </Section>

      <Section
        title="جهات الاتصال"
        meta={`${num(campaign.contactCount)} جهة`}
        action={
          canManage && editable ? (
            <>
              <UploadContacts campaignId={campaign.id} workspaceId={workspace.id} />
              {campaign.contactCount > 0 ? (
                <ClearContacts campaignId={campaign.id} workspaceId={workspace.id} />
              ) : null}
            </>
          ) : null
        }
        flush
      >
        <div className="console-table-toolbar">
          <Link
            href={`/portal/campaigns/${campaign.id}`}
            className="filter-chip"
            aria-pressed={!filter}
          >
            الكل ({num(campaign.contactCount)})
          </Link>
          {counts.map((entry) => (
            <Link
              key={entry.status}
              href={`/portal/campaigns/${campaign.id}?status=${entry.status}`}
              className="filter-chip"
              aria-pressed={filter === entry.status}
            >
              {CONTACT_STATUS_LABEL[entry.status]} ({num(entry.total)})
            </Link>
          ))}
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            title={filter ? 'لا جهات بهذه الحالة' : 'لم تُرفع قائمة بعد'}
            body={
              filter
                ? 'جرّب فلترًا آخر.'
                : 'ارفع ملف CSV يحتوي عمود أرقام. الأرقام المحلية تُحوَّل تلقائيًا للصيغة الدولية، وكل صف مرفوض يظهر بسببه.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>الاسم</th>
                  <th>الحالة</th>
                  <th>المحاولات</th>
                  <th>آخر محاولة</th>
                  <th>النتيجة</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td data-label="الرقم" dir="ltr">
                      {contact.phone}
                    </td>
                    <td data-label="الاسم">{contact.name ?? '—'}</td>
                    <td data-label="الحالة">
                      <Pill
                        tone={
                          contact.status === 'completed'
                            ? 'good'
                            : contact.status === 'failed' || contact.status === 'suppressed'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {CONTACT_STATUS_LABEL[contact.status]}
                      </Pill>
                    </td>
                    <td data-label="المحاولات">{num(contact.attempts)}</td>
                    <td data-label="آخر محاولة">
                      {contact.lastAttemptAt ? relative(contact.lastAttemptAt) : '—'}
                    </td>
                    <td data-label="النتيجة">{contact.summary ?? contact.lastError ?? '—'}</td>
                    <td data-label="إجراءات">
                      {canManage && RETRYABLE.has(contact.status) ? (
                        <RetryContact contactId={contact.id} workspaceId={workspace.id} />
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
