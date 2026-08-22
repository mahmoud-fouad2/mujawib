import { Check, X } from 'lucide-react'
import type { Metadata } from 'next'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { AddPronunciation, PronunciationRowActions } from '@/components/console/voice-actions'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { getClientOptions, getVoiceLab } from '@/server/data/console'

export const metadata: Metadata = { title: 'مختبر الصوت' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  approved: 'معتمد',
  draft: 'مسودة',
  rejected: 'مرفوض',
}

const STYLE_LABEL: Record<string, string> = {
  professional: 'احترافي',
  warm: 'ودود',
  concise: 'موجز',
  premium: 'راقٍ',
}

const CATEGORY_LABEL: Record<string, string> = {
  brand: 'علامة',
  person: 'شخص',
  area: 'منطقة',
  service: 'خدمة',
  medicine: 'دواء',
}

export default async function VoiceLabPage() {
  const [{ profiles, words, runs, passRate, criticalFailed }, clients] = await Promise.all([
    getVoiceLab(),
    getClientOptions(),
  ])

  const pendingWords = words.filter((w) => w.status === 'draft').length

  return (
    <>
      <PageHead
        title="مختبر الصوت العربي"
        sub="اللهجات، قاموس النطق، ونتائج الاختبارات التي تحكم النشر"
      />

      <SummaryBar
        items={[
          { label: 'ملف لهجة', value: num(profiles.length) },
          {
            label: 'اجتياز السيناريوهات',
            value: `${passRate}%`,
            tone: passRate >= 90 ? 'good' : 'warn',
          },
          ...(criticalFailed
            ? [
                {
                  label: 'سيناريو حرج فاشل — يمنع النشر',
                  value: num(criticalFailed),
                  tone: 'bad' as const,
                },
              ]
            : []),
          ...(pendingWords
            ? [{ label: 'نطق بانتظار الاعتماد', value: num(pendingWords), tone: 'warn' as const }]
            : []),
        ]}
      />

      <div className="split">
        <Section title="ملفات اللهجات" flush>
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الملف</th>
                  <th>اللهجة</th>
                  <th>الأسلوب</th>
                  <th>سياسة اللغة</th>
                  <th>النطاق</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const policy = (p.languagePolicy ?? {}) as { primary?: string }
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td className="mono">{p.dialect}</td>
                      <td className="muted">{STYLE_LABEL[p.style] ?? p.style}</td>
                      <td className="mono">{policy.primary ?? '—'}</td>
                      <td>{p.isGlobal ? <Pill tone="signal">عام</Pill> : <Pill>خاص</Pill>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="نتائج الاختبار" meta="آخر تشغيل لكل سيناريو" flush>
          <div className="queue">
            {runs.slice(0, 12).map((r) => (
              <div key={`${r.workspaceName}-${r.name}`} className="queue__row">
                <div>
                  <div className="queue__title">{r.name}</div>
                  <div className="queue__meta">
                    <span>{r.workspaceName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{r.category}</span>
                    {r.isCritical ? <Pill tone="warn">حرج</Pill> : null}
                  </div>
                </div>
                <span className="row" style={{ gap: 'var(--s-2)' }}>
                  <span className="mono muted">{r.score}</span>
                  {r.passed ? (
                    <Check size={15} style={{ color: 'var(--good)' }} aria-hidden="true" />
                  ) : (
                    <X size={15} style={{ color: 'var(--bad)' }} aria-hidden="true" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div style={{ height: 'var(--s-4)' }} />

      <Section
        title="قاموس النطق"
        meta={`${num(words.length)} مدخل`}
        action={<AddPronunciation workspaces={clients} />}
        flush
      >
        {words.length === 0 ? (
          <EmptyState
            title="القاموس فارغ"
            body="أضف الكلمات التي يخطئ المُجاوِب في نطقها — أسماء الأطباء، الفروع، والعلامات التجارية."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الكلمة</th>
                  <th>بالعربية</th>
                  <th>كيف تُنطق</th>
                  <th>التصنيف</th>
                  <th>العميل</th>
                  <th>الحالة</th>
                  <th>آخر تحديث</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {words.map((w) => (
                  <tr key={w.id}>
                    <td className="mono">{w.canonical}</td>
                    <td>{w.arabicDisplay ?? '—'}</td>
                    <td className="muted">{w.spokenHint}</td>
                    <td className="muted">{CATEGORY_LABEL[w.category] ?? w.category}</td>
                    <td className="muted">{w.workspaceName ?? 'عام'}</td>
                    <td>
                      <Pill
                        tone={
                          w.status === 'approved'
                            ? 'good'
                            : w.status === 'rejected'
                              ? 'bad'
                              : 'warn'
                        }
                      >
                        {STATUS_LABEL[w.status] ?? w.status}
                      </Pill>
                    </td>
                    <td className="muted">{relative(w.updatedAt)}</td>
                    <td>
                      <PronunciationRowActions id={w.id} word={w.canonical} status={w.status} />
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
