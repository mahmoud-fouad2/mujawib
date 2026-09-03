import { Check, X } from 'lucide-react'
import type { Metadata } from 'next'
import { AddPersona, PersonaRowActions } from '@/components/console/persona-manager'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { AddPronunciation, PronunciationRowActions } from '@/components/console/voice-actions'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { num, relative } from '@/lib/format'
import { dialectLabel, PERSONA_GENDER_LABEL } from '@/lib/voice-personas'
import { requireOperatorPermissionPage } from '@/server/auth/access'
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
  medicine: 'مصطلح متخصص / دواء',
}

export default async function VoiceLabPage() {
  await requireOperatorPermissionPage('voice.manage', '/console/voice-lab')

  const [{ profiles, words, wordTotals, runs, passRate, criticalFailed }, clients] =
    await Promise.all([getVoiceLab(), getClientOptions()])

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
          ...(wordTotals.pending
            ? [
                {
                  label: 'نطق بانتظار الاعتماد',
                  value: num(wordTotals.pending),
                  tone: 'warn' as const,
                },
              ]
            : []),
        ]}
      />

      <div className="split">
        <Section
          title="الشخصيات الصوتية"
          meta={`${num(profiles.filter((p) => p.isGlobal).length)} افتراضية · ${num(profiles.filter((p) => !p.isGlobal).length)} خاصة`}
          action={<AddPersona clients={clients} />}
          flush
        >
          {profiles.length === 0 ? (
            <EmptyState
              title="لا شخصيات صوتية بعد"
              body="الشخصية تحدد اللهجة والجنس والأسلوب وصوت المزوّد. الافتراضية تأتي مع المنصة؛ الخاصة يملكها عميل واحد."
            />
          ) : (
            <div className="table-scroll">
              <table className="table table--rows table--cards">
                <thead>
                  <tr>
                    <th>الشخصية</th>
                    <th>اللهجة</th>
                    <th>الجنس</th>
                    <th>الأسلوب</th>
                    <th>صوت المزوّد</th>
                    <th>النطاق</th>
                    <th aria-label="إجراءات" />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td data-label="الشخصية" style={{ fontWeight: 500 }}>
                        {p.name}
                      </td>
                      <td data-label="اللهجة">{dialectLabel(p.dialect)}</td>
                      <td data-label="الجنس">{p.gender ? PERSONA_GENDER_LABEL[p.gender] : '—'}</td>
                      <td data-label="الأسلوب" className="muted">
                        {STYLE_LABEL[p.style] ?? p.style}
                      </td>
                      {/* Printed rather than hidden: ten personas share two
                          provider voices, so this column is what explains why
                          two of them sound alike. */}
                      <td data-label="صوت المزوّد" className="mono">
                        {p.providerVoice}
                      </td>
                      <td data-label="النطاق">
                        {p.isProtected ? (
                          <Pill tone="signal">محمية</Pill>
                        ) : p.isGlobal ? (
                          <Pill tone="signal">عامة</Pill>
                        ) : (
                          <Pill>خاصة</Pill>
                        )}
                      </td>
                      <td data-label="إجراءات">
                        <PersonaRowActions row={p} clients={clients} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        meta={`${num(wordTotals.total)} مدخل`}
        action={<AddPronunciation workspaces={clients} />}
        flush
      >
        {words.length === 0 ? (
          <EmptyState
            title="القاموس فارغ"
            body="أضف الكلمات التي يخطئ المُجاوِب في نطقها — أسماء المختصين، الفروع، والعلامات التجارية."
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
