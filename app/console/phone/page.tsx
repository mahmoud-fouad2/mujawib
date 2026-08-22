import { Building2, Cable, FlaskConical, PhoneForwarded, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PhoneRowActions } from '@/components/console/infra-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { Pill, type Tone } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { getPhoneNumbers } from '@/server/data/console'

export const metadata: Metadata = { title: 'الهاتف' }
export const dynamic = 'force-dynamic'

const MODE_LABEL: Record<string, string> = {
  all_calls: 'كل المكالمات',
  overflow: 'عند الازدحام',
  after_hours: 'خارج الدوام',
}

const STATUS: Record<string, { label: string; tone: Tone; next: string }> = {
  pending: { label: 'بانتظار أول مكالمة', tone: 'warn', next: 'نفّذ مكالمة تحقق' },
  verifying: { label: 'وصلت المكالمة', tone: 'signal', next: 'راجع قبول المكالمة' },
  verified: { label: 'تم التحقق', tone: 'good', next: 'راجع الجاهزية ثم فعّل' },
  active: { label: 'نشط', tone: 'good', next: 'راقب المكالمات' },
  degraded: { label: 'يحتاج انتباهًا', tone: 'bad', next: 'راجع آخر خطأ' },
  disabled: { label: 'معطّل', tone: 'neutral', next: 'راجع الإعداد قبل التفعيل' },
}

const CONNECT_OPTIONS = [
  {
    icon: Building2,
    title: 'مقسم أو SIP قائم',
    body: 'يربطه فريق مُجاوِب يدويًا مع المقسم الحالي دون تغيير تجربة العميل.',
    state: 'إعداد يدوي',
  },
  {
    icon: PhoneForwarded,
    title: 'تحويل رقم حالي',
    body: 'تحويل مكالمات الجوال أو الهاتف الأرضي إلى المسار المُدار.',
    state: 'إعداد يدوي',
  },
  {
    icon: Plus,
    title: 'رقم مُدار جديد',
    body: 'المسار التشغيلي المتاح الآن: رقم عام مع ربط SIP يديره فريق العمليات.',
    state: 'متاح الآن',
    active: true,
  },
  {
    icon: FlaskConical,
    title: 'اختبار SIP مباشر',
    body: 'للتحقق التقني الداخلي قبل ربط رقم عام أو بدء التشغيل.',
    state: 'داخلي فقط',
  },
] as const

export default async function PhonePage() {
  const numbers = await getPhoneNumbers()
  const ready = numbers.filter((item) =>
    ['verified', 'active'].includes(item.sipStatus ?? ''),
  ).length
  const attention = numbers.length - ready
  const calls30d = numbers.reduce((sum, item) => sum + item.calls30d, 0)

  return (
    <>
      <PageHead
        title="الهاتف"
        sub="اربط رقم العميل بمسار واضح، أثبته بمكالمة حقيقية، ثم فعّله للتشغيل."
      />

      <SummaryBar
        items={[
          { label: 'رقم مربوط', value: num(numbers.length) },
          { label: 'جاهز أو نشط', value: num(ready), tone: 'good' },
          ...(attention
            ? [{ label: 'يحتاج إجراء', value: num(attention), tone: 'warn' as const }]
            : []),
          { label: 'مكالمة خلال 30 يومًا', value: num(calls30d) },
        ]}
      />

      <Section title="ربط رقم" meta="اختر المسار المناسب؛ التنفيذ الحالي يتم بواسطة فريق العمليات.">
        <div className="phone-connect-options">
          {CONNECT_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <div
                key={option.title}
                className="phone-connect-option"
                data-active={'active' in option}
              >
                <span className="phone-connect-option__icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="phone-connect-option__copy">
                  <strong>{option.title}</strong>
                  <small>{option.body}</small>
                </span>
                <span className="phone-connect-option__state">{option.state}</span>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="المسارات الحالية" flush>
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>العميل</th>
                <th>الموظف والنسخة</th>
                <th>وضع الاستقبال</th>
                <th>الحالة</th>
                <th>آخر نجاح</th>
                <th>الخطوة التالية</th>
                <th aria-label="إجراءات" />
              </tr>
            </thead>
            <tbody>
              {numbers.map((item) => {
                const status = STATUS[item.sipStatus ?? 'pending'] ?? STATUS.pending!
                const rules = (item.routingRules ?? {}) as { fallbackDisabled?: boolean }
                return (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/console/phone/${item.id}`} className="table-link mono">
                        {item.e164}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/console/clients/${item.workspaceSlug}`} className="table-link">
                        {item.workspaceName}
                      </Link>
                    </td>
                    <td>
                      {item.agentName ? (
                        <span>
                          {item.agentName}
                          {item.liveVersionStatus === 'published' && item.liveVersionNumber ? (
                            <small className="table-subline">
                              نسخة منشورة v{item.liveVersionNumber}
                            </small>
                          ) : (
                            <small className="table-subline table-subline--bad">
                              لا توجد نسخة منشورة
                            </small>
                          )}
                        </span>
                      ) : (
                        <span className="text-bad">غير معيّن</span>
                      )}
                    </td>
                    <td className="muted">{MODE_LABEL[item.mode] ?? item.mode}</td>
                    <td>
                      <Pill tone={status.tone} dot>
                        {status.label}
                      </Pill>
                    </td>
                    <td className="muted">
                      {item.lastSuccessfulCallAt ? relative(item.lastSuccessfulCallAt) : 'لا يوجد'}
                    </td>
                    <td className="muted">{status.next}</td>
                    <td>
                      <PhoneRowActions
                        id={item.id}
                        e164={item.e164}
                        mode={item.mode}
                        transferDestination={item.transferDestination}
                        fallbackDisabled={Boolean(rules.fallbackDisabled)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="page-note">
        <Cable size={14} aria-hidden="true" />
        بيانات مزود الاتصال وتفاصيل SIP داخلية ولا تظهر في بوابة العميل.
      </p>
    </>
  )
}
