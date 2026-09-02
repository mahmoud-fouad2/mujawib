import { CircleHelp } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AddPhoneNumberAction, PhoneRowActions } from '@/components/console/infra-actions'
import { PendingPhoneRequestsSection } from '@/components/console/phone-requests'
import { ConsoleSearchFilters, CsvExportButton } from '@/components/console/table-tools'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  fullDate,
  num,
  PHONE_LIFECYCLE_HINT,
  PHONE_LIFECYCLE_LABEL,
  phoneLifecycleTone,
  relative,
} from '@/lib/format'
import { getPendingPhoneRequests } from '@/server/actions/twilio'
import { getClientBySlug, getClientOptions, getPhoneNumbers } from '@/server/data/console'

export const metadata: Metadata = { title: 'الهاتف' }
export const dynamic = 'force-dynamic'

type SearchParams = { client?: string; q?: string; status?: string; range?: string }

const PHONE_STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'active', label: 'نشط' },
  { value: 'verified', label: 'تم التحقق' },
  { value: 'verifying', label: 'قيد التحقق' },
  { value: 'pending', label: 'بانتظار أول مكالمة' },
  { value: 'degraded', label: 'يحتاج انتباهًا' },
  { value: 'disabled', label: 'معطّل' },
]

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

const MODE_LABEL: Record<string, string> = {
  all_calls: 'كل المكالمات',
  overflow: 'عند الازدحام',
  after_hours: 'خارج الدوام',
}

export default async function PhonePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const search = params.q?.trim() ?? ''
  const status = PHONE_STATUS_OPTIONS.some((option) => option.value === params.status)
    ? (params.status ?? 'all')
    : 'all'
  const range = Object.hasOwn(RANGE_DAYS, params.range ?? '') ? (params.range ?? 'all') : 'all'
  const [client, clients, pendingRequests] = await Promise.all([
    params.client ? getClientBySlug(params.client) : Promise.resolve(null),
    getClientOptions(),
    getPendingPhoneRequests(),
  ])
  const allNumbers = await getPhoneNumbers(client ? { workspaceId: client.id } : {})
  const cutoffDays = RANGE_DAYS[range]
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null
  const numbers = allNumbers.filter((n) => {
    const q = search.toLowerCase()
    const statusMatch = status === 'all' || n.sipStatus === status
    const searchable = [n.e164, n.label, n.workspaceName, n.workspaceSlug, n.agentName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !q || searchable.includes(q)
    const activityDate = n.lastSuccessfulCallAt ?? n.verifiedAt ?? n.lastTestAt ?? null
    const rangeMatch = !cutoff || (activityDate && new Date(activityDate).getTime() >= cutoff)
    return statusMatch && searchMatch && rangeMatch
  })

  // Counted from evidence, not from the status string: a seeded row can carry
  // `verified` without any call ever having proved it.
  const proven = numbers.filter((n) => n.verifiedAt !== null).length
  const carrying = numbers.filter((n) => n.sipStatus === 'active').length
  const waiting = numbers.filter((n) => n.sipStatus === 'pending').length
  const stuck = numbers.filter((n) => n.sipStatus === 'verifying').length
  const calls30d = numbers.reduce((sum, n) => sum + n.calls30d, 0)

  return (
    <>
      <PageHead
        title="الأرقام والتوجيه"
        sub={
          client
            ? `أرقام ${client.name}، وهل أثبتت مكالمة حقيقية أن المسار يعمل`
            : 'أي موظف صوتي يرد على أي رقم، وهل أثبتت مكالمة حقيقية أن المسار يعمل'
        }
      />

      <SummaryBar
        items={[
          { label: 'رقم مربوط', value: num(numbers.length) },
          { label: 'أثبتته مكالمة حقيقية', value: num(proven), tone: 'good' },
          ...(carrying
            ? [{ label: 'يستقبل مكالمات', value: num(carrying), tone: 'good' as const }]
            : []),
          ...(stuck
            ? [{ label: 'تصل ولا يُرد عليها', value: num(stuck), tone: 'bad' as const }]
            : []),
          ...(waiting
            ? [{ label: 'لم تصله مكالمة بعد', value: num(waiting), tone: 'warn' as const }]
            : []),
          { label: 'مكالمة خلال 30 يومًا', value: num(calls30d) },
        ]}
      />

      <ConsoleSearchFilters
        basePath="/console/phone"
        client={params.client}
        search={search}
        status={status}
        range={range}
        searchPlaceholder="ابحث برقم أو عميل أو موظف صوتي…"
        statusOptions={PHONE_STATUS_OPTIONS}
      >
        <CsvExportButton
          filename={`mujawib-phone-routes-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={[
            'الرقم',
            'العميل',
            'الموظف الصوتي',
            'وضع الاستقبال',
            'وجهة التحويل',
            'حالة المسار',
            'آخر مكالمة ناجحة',
            'مكالمات 30 يومًا',
          ]}
          rows={numbers.map((n) => [
            n.e164,
            n.workspaceName,
            n.agentName ?? '',
            MODE_LABEL[n.mode] ?? n.mode,
            n.transferDestination ?? '',
            PHONE_LIFECYCLE_LABEL[n.sipStatus ?? 'pending'] ?? n.sipStatus ?? 'pending',
            n.lastSuccessfulCallAt ? fullDate(n.lastSuccessfulCallAt) : '',
            n.calls30d,
          ])}
        />
      </ConsoleSearchFilters>

      {pendingRequests.length > 0 ? (
        <Section
          title="طلبات شراء أرقام بانتظار الاعتماد"
          meta={`${num(pendingRequests.length)} طلب`}
          flush
        >
          <PendingPhoneRequestsSection requests={pendingRequests} />
        </Section>
      ) : null}

      <Section title="الأرقام" action={<AddPhoneNumberAction clients={clients} />} flush>
        {allNumbers.length === 0 ? (
          <EmptyState
            title="لا يوجد رقم مربوط"
            body="اربط رقمًا بعميل وموظف صوتي منشور، ثم اتصل به لإثبات أن المسار يعمل."
          />
        ) : numbers.length === 0 ? (
          <EmptyState title="لا نتائج مطابقة" body="غيّر البحث أو الفلاتر لعرض أرقام أخرى." />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows table--cards">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>العميل</th>
                  <th>الموظف الصوتي</th>
                  <th>وضع الاستقبال</th>
                  <th>وجهة التحويل</th>
                  <th>حالة المسار</th>
                  <th>آخر مكالمة ناجحة</th>
                  <th>مكالمات 30 يومًا</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => {
                  const status = n.sipStatus ?? 'pending'
                  const publishedVersion =
                    n.liveVersionStatus === 'published' ? n.liveVersionNumber : null

                  return (
                    <tr key={n.id}>
                      <td className="mono" style={{ fontWeight: 500 }} dir="ltr" data-label="الرقم">
                        <Link href={`/console/phone/${n.id}`}>{n.e164}</Link>
                      </td>
                      <td data-label="العميل" className="muted">
                        <Link href={`/console/clients/${n.workspaceSlug}`}>{n.workspaceName}</Link>
                      </td>
                      <td data-label="الموظف الصوتي">
                        {n.agentName ? (
                          <>
                            {n.agentName}
                            {publishedVersion ? (
                              <span className="muted mono"> · v{publishedVersion}</span>
                            ) : (
                              <Pill tone="bad">بلا نسخة منشورة</Pill>
                            )}
                          </>
                        ) : (
                          <Pill tone="bad">لم يُسنَد</Pill>
                        )}
                      </td>
                      <td data-label="وضع الاستقبال" className="muted">
                        {MODE_LABEL[n.mode] ?? n.mode}
                      </td>
                      <td data-label="وجهة التحويل" className="mono muted" dir="ltr">
                        {n.transferDestination ?? '—'}
                      </td>
                      <td data-label="حالة المسار">
                        <span className="route-state">
                          <Pill tone={phoneLifecycleTone(status)} dot>
                            {PHONE_LIFECYCLE_LABEL[status] ?? status}
                          </Pill>
                          <span
                            className="route-state__why"
                            title={PHONE_LIFECYCLE_HINT[status] ?? ''}
                          >
                            <CircleHelp size={13} aria-hidden="true" />
                            <span className="visually-hidden">
                              {PHONE_LIFECYCLE_HINT[status] ?? ''}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td data-label="آخر مكالمة ناجحة" className="muted">
                        {n.lastSuccessfulCallAt ? relative(n.lastSuccessfulCallAt) : 'لا يوجد'}
                      </td>
                      <td data-label="مكالمات 30 يومًا" className="mono">
                        {num(n.calls30d)}
                      </td>
                      <td>
                        <PhoneRowActions
                          id={n.id}
                          e164={n.e164}
                          mode={n.mode}
                          transferDestination={n.transferDestination}
                          fallbackDisabled={
                            (n.routingRules as { fallbackDisabled?: boolean } | null)
                              ?.fallbackDisabled === true
                          }
                          agentId={n.agentId}
                          workspaceName={n.workspaceName}
                          agentName={n.agentName}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
