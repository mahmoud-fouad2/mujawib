import type { Metadata } from 'next'
import { PhoneRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { getPhoneNumbers } from '@/server/data/console'

export const metadata: Metadata = { title: 'الهاتف' }
export const dynamic = 'force-dynamic'

const MODE_LABEL: Record<string, string> = {
  all_calls: 'كل المكالمات',
  overflow: 'عند الازدحام',
  after_hours: 'خارج الدوام',
}

export default async function PhonePage() {
  const numbers = await getPhoneNumbers()
  const verified = numbers.filter((n) => n.sipStatus === 'verified').length
  const pending = numbers.length - verified
  const calls30d = numbers.reduce((s, n) => s + n.calls30d, 0)

  return (
    <>
      <PageHead
        title="الأرقام والتوجيه"
        sub="أي موظف صوتي يرد على أي رقم، ومتى، وإلى أين يحوّل عند التصعيد"
      />

      <SummaryBar
        items={[
          { label: 'رقم مربوط', value: num(numbers.length) },
          { label: 'مسار موثّق', value: num(verified), tone: 'good' },
          ...(pending
            ? [{ label: 'بانتظار اختبار', value: num(pending), tone: 'warn' as const }]
            : []),
          { label: 'مكالمة خلال 30 يومًا', value: num(calls30d) },
        ]}
      />

      <Section title="الأرقام" flush>
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
                <th>آخر اختبار</th>
                <th>مكالمات 30 يومًا</th>
                <th aria-label="إجراءات" />
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {n.e164}
                  </td>
                  <td className="muted">{n.workspaceName}</td>
                  <td>{n.agentName ?? '—'}</td>
                  <td className="muted">{MODE_LABEL[n.mode] ?? n.mode}</td>
                  <td className="mono muted">{n.transferDestination ?? '—'}</td>
                  <td>
                    <Pill tone={n.sipStatus === 'verified' ? 'good' : 'warn'} dot>
                      {n.sipStatus === 'verified' ? 'موثّق' : 'بانتظار اختبار'}
                    </Pill>
                  </td>
                  <td className="muted">{n.lastTestAt ? relative(n.lastTestAt) : '—'}</td>
                  <td className="mono">{num(n.calls30d)}</td>
                  <td>
                    <PhoneRowActions
                      id={n.id}
                      e164={n.e164}
                      mode={n.mode}
                      transferDestination={n.transferDestination}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
