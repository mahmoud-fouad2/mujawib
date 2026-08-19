import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DailyBars, Ratio, Sparkline } from '@/components/console/charts'
import { ClientRowActions } from '@/components/console/client-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CHANGE_STATUS_LABEL,
  clock,
  dayMonth,
  duration,
  HEALTH_LABEL,
  healthTone,
  maskPhone,
  num,
  outcomeTone,
  relative,
  WORKSPACE_STATUS_LABEL,
} from '@/lib/format'
import { getClientDetail } from '@/server/data/console'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getClientDetail((await params).slug)
  return { title: detail?.workspace.name ?? 'عميل' }
}

const KNOWLEDGE_LABEL: Record<string, string> = {
  service: 'خدمات',
  branch: 'فروع',
  staff: 'فريق',
  policy: 'سياسات',
  faq: 'أسئلة',
  document: 'مستندات',
}

export default async function ClientDetailPage({ params }: Props) {
  const detail = await getClientDetail((await params).slug)
  if (!detail) notFound()

  const { workspace: ws, totals, agents, numbers, integrations, requests, knowledge } = detail
  const info = (ws.businessInfo ?? {}) as {
    city?: string
    hours?: { sun_thu?: string }
    transferTo?: string
    branches?: string[]
  }
  const openRequests = requests.filter((r) => r.status !== 'live' && r.status !== 'rejected')
  const unhealthy = integrations.filter((i) => i.health !== 'connected')

  return (
    <>
      <div className="detail-back">
        <Link href="/console/clients" className="btn btn--quiet btn--sm">
          <ArrowLeft size={14} className="arrow" aria-hidden="true" />
          كل العملاء
        </Link>
      </div>

      <PageHead
        title={ws.name}
        sub={`${info.city ?? '—'} · ${WORKSPACE_STATUS_LABEL[ws.status] ?? ws.status} · منذ ${relative(ws.createdAt)}`}
        actions={
          <ClientRowActions
            workspaceId={ws.id}
            name={ws.name}
            status={ws.status}
            city={info.city ?? ''}
            hoursWeekday={info.hours?.sun_thu ?? ''}
            transferTo={info.transferTo ?? ''}
          />
        }
      />

      <SummaryBar
        items={[
          { label: 'مكالمة خلال 30 يومًا', value: num(totals.calls) },
          { label: 'أُغلقت بدون تدخل', value: `${totals.resolvedRate}%`, tone: 'good' },
          { label: 'تحويل للفريق', value: num(totals.transfers) },
          { label: 'خارج ساعات العمل', value: num(totals.afterHours) },
          ...(unhealthy.length
            ? [{ label: 'ربط يحتاج تدخّل', value: num(unhealthy.length), tone: 'bad' as const }]
            : []),
        ]}
      />

      <div className="split">
        <Section title="حجم المكالمات" meta="آخر 14 يومًا" flush>
          {detail.trend.length === 0 ? (
            <EmptyState title="لا مكالمات بعد" body="لم يستقبل هذا العميل أي مكالمة حتى الآن." />
          ) : (
            <DailyBars
              points={detail.trend.map((t) => ({
                label: dayMonth(t.day),
                value: t.total,
                secondary: t.resolved,
              }))}
              fromLabel={dayMonth(detail.trend[0]?.day ?? new Date())}
              toLabel={dayMonth(detail.trend.at(-1)?.day ?? new Date())}
              legend={{ total: 'إجمالي', filled: 'أُغلقت بدون تدخل' }}
            />
          )}
        </Section>

        <Section title="جودة التشغيل" meta="آخر 30 يومًا">
          <div className="ratio-row">
            <Ratio
              value={totals.resolvedRate}
              label="نسبة الإغلاق"
              tone={totals.resolvedRate >= 75 ? 'good' : 'warn'}
            />
            <div className="ratio-row__note">
              <p>من المكالمات المنتهية أُغلقت دون تدخل موظف. الباقي تحويل أو معاودة اتصال.</p>
              <Sparkline
                points={detail.trend.map((t) =>
                  t.total ? Math.round((t.resolved / t.total) * 100) : 0,
                )}
                tone="good"
                width={150}
                height={32}
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="split">
        <Section title="الموظفون الصوتيون" meta={`${num(agents.length)}`} flush>
          {agents.length === 0 ? (
            <EmptyState title="لا موظف صوتي" body="لم يُبنَ موظف صوتي لهذا العميل بعد." />
          ) : (
            <div className="queue">
              {agents.map((a) => (
                <Link key={a.id} href={`/console/agents/${a.id}`} className="queue__row">
                  <div>
                    <div className="queue__title">{a.name}</div>
                    <div className="queue__meta">
                      <span>{a.liveVersionId ? 'نسخة منشورة' : 'لم تُنشر بعد'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{relative(a.updatedAt)}</span>
                    </div>
                  </div>
                  <Pill tone={a.liveVersionId ? 'good' : 'warn'}>
                    {a.liveVersionId ? 'يعمل' : 'مسودة'}
                  </Pill>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="الأرقام" meta={`${num(numbers.length)}`} flush>
          {numbers.length === 0 ? (
            <EmptyState title="لا رقم مربوط" body="اربط رقمًا لتبدأ المكالمات في الوصول." />
          ) : (
            <div className="queue">
              {numbers.map((n) => (
                <div key={n.id} className="queue__row">
                  <div>
                    <div className="queue__title mono">{n.e164}</div>
                    <div className="queue__meta">
                      <span>{n.label ?? '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="mono">{n.transferDestination ?? 'بلا تحويل'}</span>
                    </div>
                  </div>
                  <Pill tone={n.sipStatus === 'verified' ? 'good' : 'warn'} dot>
                    {n.sipStatus === 'verified' ? 'موثّق' : 'بانتظار اختبار'}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="split">
        <Section title="الربط" meta={`${num(integrations.length)}`} flush>
          <div className="queue">
            {integrations.map((i) => (
              <div key={i.id} className="queue__row">
                <div>
                  <div className="queue__title">{i.label}</div>
                  <div className="queue__meta">
                    <span>
                      {i.lastSuccessAt ? `آخر نجاح ${relative(i.lastSuccessAt)}` : 'لم ينجح بعد'}
                    </span>
                  </div>
                </div>
                <Pill tone={healthTone(i.health)} dot>
                  {HEALTH_LABEL[i.health] ?? i.health}
                </Pill>
              </div>
            ))}
          </div>
        </Section>

        <Section title="المعرفة وطلبات التعديل" flush>
          <div className="queue">
            {knowledge.map((k) => (
              <div key={k.category} className="queue__row">
                <div className="queue__title">{KNOWLEDGE_LABEL[k.category] ?? k.category}</div>
                <span className="mono muted">{num(k.n)}</span>
              </div>
            ))}
            <div className="queue__row">
              <div className="queue__title">طلبات مفتوحة</div>
              <span className="mono muted">{num(openRequests.length)}</span>
            </div>
            {openRequests.slice(0, 3).map((r) => (
              <div key={r.id} className="queue__row">
                <div>
                  <div className="queue__title">{r.title}</div>
                  <div className="queue__meta">{relative(r.createdAt)}</div>
                </div>
                <Pill tone={r.status === 'scheduled' ? 'signal' : 'warn'}>
                  {CHANGE_STATUS_LABEL[r.status] ?? r.status}
                </Pill>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section
        title="آخر المكالمات"
        action={
          <Link href="/console/calls" className="btn btn--quiet btn--sm">
            كل المكالمات
          </Link>
        }
        flush
      >
        {detail.recentCalls.length === 0 ? (
          <EmptyState title="لا مكالمات" body="ستظهر هنا أول مكالمة يستقبلها هذا العميل." />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>المتصل</th>
                  <th>النية</th>
                  <th>النتيجة</th>
                  <th>المدة</th>
                  <th>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentCalls.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/console/calls?call=${c.id}`} className="mono">
                        {maskPhone(c.callerNumber)}
                      </Link>
                    </td>
                    <td className="muted">{c.intent ?? '—'}</td>
                    <td>
                      <Pill tone={outcomeTone(c.outcome)}>
                        {c.outcome ? (CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome) : '—'}
                      </Pill>
                    </td>
                    <td className="mono">{duration(c.durationSeconds)}</td>
                    <td className="muted">
                      {relative(c.startedAt)} · <span className="mono">{clock(c.startedAt)}</span>
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
