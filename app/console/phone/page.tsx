import { CircleHelp } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PhoneRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  num,
  PHONE_LIFECYCLE_HINT,
  PHONE_LIFECYCLE_LABEL,
  phoneLifecycleTone,
  relative,
} from '@/lib/format'
import { getClientBySlug, getPhoneNumbers } from '@/server/data/console'

export const metadata: Metadata = { title: 'الهاتف' }
export const dynamic = 'force-dynamic'

const MODE_LABEL: Record<string, string> = {
  all_calls: 'كل المكالمات',
  overflow: 'عند الازدحام',
  after_hours: 'خارج الدوام',
}

export default async function PhonePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const params = await searchParams
  const client = params.client ? await getClientBySlug(params.client) : null
  const numbers = await getPhoneNumbers(client ? { workspaceId: client.id } : {})

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

      <Section title="الأرقام" flush>
        {numbers.length === 0 ? (
          <EmptyState
            title="لا يوجد رقم مربوط"
            body="اربط رقمًا بعميل وموظف صوتي منشور، ثم اتصل به لإثبات أن المسار يعمل."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
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
                      <td className="mono" style={{ fontWeight: 500 }} dir="ltr">
                        <Link href={`/console/phone/${n.id}`}>{n.e164}</Link>
                      </td>
                      <td className="muted">
                        <Link href={`/console/clients/${n.workspaceSlug}`}>{n.workspaceName}</Link>
                      </td>
                      <td>
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
                      <td className="muted">{MODE_LABEL[n.mode] ?? n.mode}</td>
                      <td className="mono muted" dir="ltr">
                        {n.transferDestination ?? '—'}
                      </td>
                      <td>
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
                      <td className="muted">
                        {n.lastSuccessfulCallAt ? relative(n.lastSuccessfulCallAt) : 'لا يوجد'}
                      </td>
                      <td className="mono">{num(n.calls30d)}</td>
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
