import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewCampaign, StartCampaign } from '@/components/console/campaign-review'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  ATTEMPT_REASON_LABEL,
  CAMPAIGN_PURPOSE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CONSENT_BASIS_LABEL,
  CONTACT_STATUS_LABEL,
  minuteToTime,
  WEEKDAY_LABEL,
} from '@/lib/campaigns'
import { fullDate, num, relative } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import {
  getCampaignAttempts,
  getCampaignDetail,
  getContactStatusCounts,
} from '@/server/data/campaigns'
import { outboundDialerStatus } from '@/server/outbound/dialer'
import { dispatchReasonLabel } from '@/server/outbound/dispatcher'

export const metadata: Metadata = { title: 'مراجعة حملة' }
export const dynamic = 'force-dynamic'

/** `outcome` is 'placed', one of the pre-dial refusal codes, or null (a real dial failure — see the adjacent error column instead). */
function attemptOutcomeLabel(outcome: string | null): string {
  if (outcome === 'placed') return 'تم الاتصال'
  if (!outcome) return '—'
  return ATTEMPT_REASON_LABEL[outcome as keyof typeof ATTEMPT_REASON_LABEL] ?? outcome
}

export default async function ConsoleCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperatorPermissionPage('campaign.approve', '/console/campaigns')

  const { id } = await params
  const campaign = await getCampaignDetail(id)
  if (!campaign) notFound()

  const [counts, attempts] = await Promise.all([
    getContactStatusCounts(campaign.id),
    getCampaignAttempts(campaign.id),
  ])
  const dialer = outboundDialerStatus()

  return (
    <>
      <PageHead
        title={campaign.name}
        sub={
          <Link href="/console/campaigns" className="detail-back">
            ← كل الحملات
          </Link>
        }
        actions={
          <>
            {campaign.status === 'pending_review' ? (
              <ReviewCampaign campaignId={campaign.id} />
            ) : null}
            {campaign.status === 'approved' || campaign.status === 'paused' ? (
              <StartCampaign
                campaignId={campaign.id}
                contactCount={campaign.contactCount}
                dialerReady={dialer.ready}
              />
            ) : null}
          </>
        }
      />

      {!dialer.ready && (campaign.status === 'approved' || campaign.status === 'paused') ? (
        <div className="notice notice--warn" role="status">
          <strong>لا يمكن التشغيل: الاتصال الصادر غير مُهيّأ.</strong>
          <p>
            الناقص: <code dir="ltr">{dialer.missing.join(', ')}</code>
          </p>
        </div>
      ) : null}

      <SummaryBar
        items={[
          { label: 'العميل', value: campaign.workspaceName },
          { label: 'الجهات', value: num(campaign.contactCount) },
          { label: 'أُنجزت', value: num(campaign.doneCount) },
          { label: 'الحالة', value: CAMPAIGN_STATUS_LABEL[campaign.status] },
        ]}
      />

      <Section title="ما يجب مراجعته قبل الاعتماد">
        <ul className="stat-list">
          <li>
            <span>الأساس القانوني</span>
            <strong>
              {campaign.consentBasis ? CONSENT_BASIS_LABEL[campaign.consentBasis] : '— غير محدد'}
            </strong>
          </li>
          <li>
            <span>مصدر القائمة (بحسب العميل)</span>
            <strong>{campaign.consentNote ?? '— لم يُذكر'}</strong>
          </li>
          <li>
            <span>الغرض</span>
            <strong>{campaign.purpose ? CAMPAIGN_PURPOSE_LABEL[campaign.purpose] : '—'}</strong>
          </li>
          <li>
            <span>الموظف الصوتي</span>
            <strong>
              {campaign.agentName
                ? `${campaign.agentName} — نسخة ${campaign.agentVersionNumber}`
                : '— غير محدد'}
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
            <span>الحد اليومي · أقصى تزامن</span>
            <strong>
              {num(campaign.dailyCap)} · {num(campaign.pacing.maxConcurrency)}
            </strong>
          </li>
          <li>
            <span>أُرسلت للمراجعة</span>
            <strong>{campaign.submittedAt ? fullDate(campaign.submittedAt) : '—'}</strong>
          </li>
        </ul>

        <div className="detail-section-label">تعليمات المكالمة</div>
        <p className="card-sub">{campaign.script ?? 'لم تُكتب بعد.'}</p>

        <div className="detail-section-label">ممنوع قوله</div>
        <p className="card-sub">
          {campaign.forbiddenClaims ?? 'لم يُحدَّد شيء — راجع هذا قبل الاعتماد.'}
        </p>

        {campaign.reviewNote ? (
          <>
            <div className="detail-section-label">ملاحظة المراجعة السابقة</div>
            <p className="card-sub">{campaign.reviewNote}</p>
          </>
        ) : null}
      </Section>

      <Section title="توزيع الجهات" flush>
        {counts.length === 0 ? (
          <EmptyState title="لا جهات" body="لم يرفع العميل قائمة بعد." />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الحالة</th>
                  <th>العدد</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((entry) => (
                  <tr key={entry.status}>
                    <td data-label="الحالة">
                      <Pill tone={entry.status === 'completed' ? 'good' : 'neutral'}>
                        {CONTACT_STATUS_LABEL[entry.status]}
                      </Pill>
                    </td>
                    <td data-label="العدد">{num(entry.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="سجل المحاولات"
        meta={
          campaign.status === 'running'
            ? (dispatchReasonLabel(campaign.lastDispatchReason) ?? '')
            : ''
        }
        flush
      >
        {attempts.length === 0 ? (
          <EmptyState
            title="لم تُجرَ أي محاولة"
            body="يُسجَّل هنا كل اتصال حاولت المنصة إجراءه، بما في ذلك المحاولات التي رُفضت قبل الطلب."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>وُضعت</th>
                  <th>النتيجة</th>
                  <th>الخطأ</th>
                  <th>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td data-label="الرقم" dir="ltr">
                      {attempt.maskedPhone}
                    </td>
                    <td data-label="وُضعت">
                      <Pill tone={attempt.placed ? 'good' : 'neutral'}>
                        {attempt.placed ? 'نعم' : 'لا'}
                      </Pill>
                    </td>
                    <td data-label="النتيجة">{attemptOutcomeLabel(attempt.outcome)}</td>
                    <td data-label="الخطأ">{attempt.error ?? '—'}</td>
                    <td data-label="الوقت">{relative(attempt.createdAt)}</td>
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
