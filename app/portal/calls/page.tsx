import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  clock,
  duration,
  fullDate,
  maskPhone,
  num,
  outcomeTone,
} from '@/lib/format'
import { getPortalCalls, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'المكالمات' }
export const dynamic = 'force-dynamic'

export default async function PortalCallsPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const calls = await getPortalCalls(workspace.id, 60)

  return (
    <>
      <PageHead title="المكالمات" sub={`${num(calls.length)} مكالمة — مرتّبة من الأحدث`} />

      <Section title="سجل المكالمات" flush>
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>المتصل</th>
                <th>السبب</th>
                <th>النتيجة</th>
                <th>الفرع</th>
                <th>المدة</th>
                <th>التاريخ</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const meta = (c.metadata ?? {}) as { branch?: string }
                return (
                  <tr key={c.id}>
                    <td className="mono">{maskPhone(c.callerNumber)}</td>
                    <td className="muted">{c.intent ?? '—'}</td>
                    <td>
                      <Pill tone={outcomeTone(c.outcome)}>
                        {c.outcome ? (CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome) : '—'}
                      </Pill>
                    </td>
                    <td className="muted">{meta.branch ?? '—'}</td>
                    <td className="mono">{duration(c.durationSeconds)}</td>
                    <td className="muted">{fullDate(c.startedAt)}</td>
                    <td className="mono">{clock(c.startedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
