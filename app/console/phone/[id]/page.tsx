import { ArrowLeft, Check, CircleAlert, CircleDashed, PhoneCall } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PhoneLifecycleActions, PhoneRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { LinkButton } from '@/components/ui/button'
import { Pill, type Tone } from '@/components/ui/primitives'
import { CALL_OUTCOME_LABEL, CALL_STATUS_LABEL, fullDate, relative, statusTone } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import { getPhoneNumberDetail } from '@/server/data/console'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }> }
type RoutingRules = {
  connectionType?: string
  providerNote?: string
  fallbackDisabled?: boolean
  lastError?: string
}

const MODE_LABEL: Record<string, string> = {
  all_calls: 'كل المكالمات',
  overflow: 'عند الازدحام',
  after_hours: 'خارج الدوام',
}

const PHONE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'بانتظار أول مكالمة', tone: 'warn' },
  verifying: { label: 'وصلت المكالمة وبانتظار القبول', tone: 'signal' },
  verified: { label: 'تم التحقق بمكالمة حقيقية', tone: 'good' },
  active: { label: 'نشط', tone: 'good' },
  degraded: { label: 'يحتاج انتباهًا', tone: 'bad' },
  disabled: { label: 'معطّل', tone: 'neutral' },
}

const CONNECTION_LABEL: Record<string, string> = {
  managed_did_sip: 'رقم مُدار / مسار SIP',
  existing_pbx: 'مقسم أو SIP قائم',
  forwarding: 'تحويل رقم حالي',
  direct_sip_test: 'اختبار SIP مباشر',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const phone = await getPhoneNumberDetail((await params).id)
  return { title: phone?.e164 ?? 'تفاصيل الرقم' }
}

export default async function PhoneDetailPage({ params, searchParams }: Props) {
  await requireOperatorPermissionPage('phone.manage', '/console/phone')

  const phone = await getPhoneNumberDetail((await params).id)
  if (!phone) notFound()
  const client = (await searchParams).client

  const rules = (phone.routingRules ?? {}) as RoutingRules
  const status = PHONE_STATUS[phone.sipStatus ?? 'pending'] ?? PHONE_STATUS.pending!
  const hasPublishedVersion = Boolean(
    phone.liveVersionId && phone.liveVersionStatus === 'published',
  )
  const fallbackReady = Boolean(phone.transferDestination || rules.fallbackDisabled)
  const verified = Boolean(phone.verifiedAt)
  const isActive = phone.sipStatus === 'active'

  const readiness = [
    {
      label: 'ربط العميل',
      done: Boolean(phone.workspaceId),
      note: phone.workspaceName,
      owner: 'العمليات',
    },
    {
      label: 'موظف بنسخة منشورة',
      done: hasPublishedVersion,
      note: hasPublishedVersion
        ? `${phone.agentName} · v${phone.liveVersionNumber}`
        : 'اختر موظفًا لديه نسخة منشورة',
      owner: 'المنتج',
    },
    {
      label: 'قرار التصعيد البشري',
      done: fallbackReady,
      note: phone.transferDestination
        ? `تحويل إلى ${phone.transferDestination}`
        : rules.fallbackDisabled
          ? 'معطّل عمدًا لمسار الاختبار'
          : 'أضف رقم تحويل أو عطّله صراحةً للاختبار',
      owner: 'العمليات',
    },
    {
      label: 'مكالمة تحقق حقيقية',
      done: verified,
      note: verified ? `نجحت ${relative(phone.verifiedAt)}` : 'اتصل بالرقم وانتظر رد الموظف',
      owner: 'الاختبار',
    },
    {
      label: 'التشغيل',
      done: isActive,
      note: isActive
        ? 'المسار نشط ويقبل المكالمات'
        : verified
          ? 'جاهز لمراجعة أخيرة ثم التفعيل'
          : 'ينتظر اكتمال الخطوات السابقة',
      owner: 'العمليات',
    },
  ]
  const completed = readiness.filter((step) => step.done).length
  const agents = phone.availableAgents
    .filter((item) => item.liveVersionId && item.versionStatus === 'published')
    .map((item) => ({ id: item.id, label: `${item.name} · v${item.versionNumber}` }))

  return (
    <>
      <div className="detail-back">
        <Link
          href={client ? `/console/clients/${client}` : '/console/phone'}
          className="btn btn--quiet btn--sm"
        >
          <ArrowLeft size={14} className="arrow" aria-hidden="true" />
          {client ? 'رجوع للعميل' : 'كل الأرقام'}
        </Link>
      </div>

      <PageHead
        title={phone.e164}
        sub={`${phone.workspaceName} · ${CONNECTION_LABEL[rules.connectionType ?? 'managed_did_sip']}`}
        actions={<PhoneLifecycleActions id={phone.id} status={phone.sipStatus} />}
      />

      <SummaryBar
        items={[
          {
            label: 'حالة المسار',
            value: status.label,
            tone: status.tone === 'good' ? 'good' : status.tone === 'bad' ? 'bad' : 'warn',
          },
          {
            label: 'اكتمال الجاهزية',
            value: `${completed}/5`,
            tone: completed === 5 ? 'good' : 'warn',
          },
          {
            label: 'آخر مكالمة ناجحة',
            value: phone.lastSuccessfulCallAt ? relative(phone.lastSuccessfulCallAt) : 'لا يوجد',
          },
        ]}
        action={
          <PhoneRowActions
            id={phone.id}
            e164={phone.e164}
            mode={phone.mode}
            transferDestination={phone.transferDestination}
            fallbackDisabled={Boolean(rules.fallbackDisabled)}
            agentId={phone.agentId}
            agents={agents}
          />
        }
      />

      <div className="phone-detail-layout">
        <Section title="جاهزية التشغيل" meta="كل خطوة مرتبطة بدليل أو قرار واضح.">
          <ol className="readiness-list">
            {readiness.map((step, index) => (
              <li key={step.label} className="readiness-step" data-done={step.done}>
                <span className="readiness-step__icon">
                  {step.done ? <Check size={15} /> : <CircleDashed size={15} />}
                </span>
                <span className="readiness-step__copy">
                  <strong>
                    {index + 1}. {step.label}
                  </strong>
                  <small>{step.note}</small>
                </span>
                <span className="readiness-step__owner">{step.owner}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="بيانات المسار" meta="تفاصيل تشغيلية لفريق مُجاوِب.">
          <dl className="phone-facts">
            <div>
              <dt>العميل</dt>
              <dd>
                <Link href={`/console/clients/${phone.workspaceSlug}`}>{phone.workspaceName}</Link>
              </dd>
            </div>
            <div>
              <dt>الموظف</dt>
              <dd>{phone.agentName ?? 'غير معيّن'}</dd>
            </div>
            <div>
              <dt>النسخة العاملة</dt>
              <dd>{hasPublishedVersion ? `v${phone.liveVersionNumber} · منشورة` : 'غير جاهزة'}</dd>
            </div>
            <div>
              <dt>نوع الاتصال</dt>
              <dd>{CONNECTION_LABEL[rules.connectionType ?? 'managed_did_sip']}</dd>
            </div>
            <div>
              <dt>وضع الاستقبال</dt>
              <dd>{MODE_LABEL[phone.mode] ?? phone.mode}</dd>
            </div>
            <div>
              <dt>التصعيد</dt>
              <dd>
                {phone.transferDestination ??
                  (rules.fallbackDisabled ? 'معطّل عمدًا للاختبار' : 'غير مضبوط')}
              </dd>
            </div>
            <div>
              <dt>دليل التحقق</dt>
              <dd>{phone.verifiedAt ? fullDate(phone.verifiedAt) : 'لا يوجد'}</dd>
            </div>
            <div>
              <dt>مزود العبور</dt>
              <dd>
                {rules.providerNote ?? 'غير مسجل'} <small>داخلي فقط</small>
              </dd>
            </div>
          </dl>
          {rules.lastError ? (
            <div className="inline-alert" data-tone="bad">
              <CircleAlert size={16} />
              <span>
                <strong>آخر خطأ</strong>
                {rules.lastError}
              </span>
            </div>
          ) : null}
        </Section>
      </div>

      <Section
        title="آخر المكالمات"
        meta="أرقام المتصلين مخفية داخل شاشة العمليات."
        action={
          <LinkButton
            href={`/console/calls?phone=${phone.id}`}
            size="sm"
            leading={<PhoneCall size={14} />}
          >
            عرض كل المكالمات
          </LinkButton>
        }
        flush
      >
        <div className="table-scroll">
          <table className="table table--rows table--cards">
            <thead>
              <tr>
                <th>المتصل</th>
                <th>الحالة</th>
                <th>النتيجة</th>
                <th>بدأت</th>
                <th>انتهت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {phone.recentCalls.length ? (
                phone.recentCalls.map((item) => (
                  <tr key={item.id}>
                    <td data-label="المتصل" className="mono">
                      {item.callerNumber ?? '—'}
                    </td>
                    <td data-label="الحالة">
                      <Pill tone={statusTone(item.status)}>
                        {CALL_STATUS_LABEL[item.status] ?? item.status}
                      </Pill>
                    </td>
                    <td data-label="النتيجة">
                      {item.outcome
                        ? (CALL_OUTCOME_LABEL[item.outcome] ?? item.outcome)
                        : 'لم تُسجل بعد'}
                    </td>
                    <td data-label="بدأت" className="muted">
                      {relative(item.startedAt)}
                    </td>
                    <td data-label="انتهت" className="muted">
                      {item.endedAt ? relative(item.endedAt) : 'غير متاح'}
                    </td>
                    <td>
                      <Link href={`/console/calls/${item.id}`} className="table-link">
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    لم تصل مكالمات على هذا الرقم بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
