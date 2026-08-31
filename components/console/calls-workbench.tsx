'use client'

import { Check, MessageSquareText, PanelRightOpen, Search, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RecordingPlayer } from '@/components/calls/recording-player'
import { CallIntelligenceStatus } from '@/components/console/call-intelligence-status'
import { QuickPronunciationFix } from '@/components/console/quick-pronunciation'
import { Sheet } from '@/components/ui/overlays'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CALL_STATUS_LABEL,
  clock,
  duration,
  EVENT_LABEL,
  fullDate,
  outcomeTone,
  relative,
  statusTone,
  TOOL_LABEL,
} from '@/lib/format'
import type { getCallDetail, getCalls } from '@/server/data/console'

type CallRow = Awaited<ReturnType<typeof getCalls>>[number]
type CallDetail = NonNullable<Awaited<ReturnType<typeof getCallDetail>>>

const CALL_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'needs_review', label: 'تحتاج مراجعة' },
  { id: 'resolved', label: 'أُنجزت' },
  { id: 'transferred', label: 'محوّلة' },
  { id: 'failed', label: 'لم تُحل' },
  { id: 'demo', label: 'بيانات تجريبية' },
] as const

function hrefFor(filter: string, callId?: string, search?: string) {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('filter', filter)
  if (search) params.set('q', search)
  if (callId) params.set('call', callId)
  const qs = params.toString()
  return `/console/calls${qs ? `?${qs}` : ''}`
}

/**
 * Bible §9: an operations inbox, not a table of rows that open new pages.
 * Filters stay pinned, the list stays in place, and the detail and inspector
 * change around the selection.
 */
export function CallsWorkbench({
  rows,
  selected,
  filter,
  search,
  canRetrySummary,
}: {
  rows: CallRow[]
  selected: CallDetail | null
  filter: string
  search?: string
  canRetrySummary: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState(search ?? '')

  useEffect(() => setQuery(search ?? ''), [search])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === (search ?? '')) return
    const id = window.setTimeout(() => {
      router.replace(hrefFor(filter, undefined, trimmed || undefined), { scroll: false })
    }, 350)
    return () => window.clearTimeout(id)
  }, [query, search, filter, router])

  return (
    <div className="workbench">
      <div className="workbench__list">
        <div className="workbench__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم المتصل، النية، أو معرّف المكالمة…"
            aria-label="بحث في المكالمات"
          />
        </div>
        <div className="workbench__filters">
          {CALL_FILTERS.map((f) => (
            <Link
              key={f.id}
              href={hrefFor(f.id, undefined, search)}
              className={`filter-chip${f.id === filter ? ' is-active' : ''}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <h3>لا مكالمات في هذا التصنيف</h3>
            <p>غيّر التصنيف أو امسح البحث لعرض نتائج أخرى.</p>
          </div>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={hrefFor(filter, r.id, search)}
              className={`list-item${selected?.id === r.id ? ' is-active' : ''}`}
            >
              <div className="list-item__top">
                <span className="list-item__who">{r.callerNumber ?? '—'}</span>
                <span className="list-item__time">{duration(r.durationSeconds)}</span>
              </div>
              <div className="list-item__meta">
                <Pill
                  tone={r.outcome ? outcomeTone(r.outcome) : statusTone(r.status)}
                  live={r.status === 'live'}
                >
                  {r.outcome
                    ? (CALL_OUTCOME_LABEL[r.outcome] ?? r.outcome)
                    : (CALL_STATUS_LABEL[r.status] ?? r.status)}
                </Pill>
                <span>{r.intent ?? '—'}</span>
              </div>
              <div className="list-item__meta">
                <span>{r.workspaceName}</span>
                <span aria-hidden="true">·</span>
                <span>{relative(r.startedAt)}</span>
                {r.origin === 'seed' ? <Pill>تجريبية</Pill> : null}
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="workbench__detail">
        {selected ? (
          <CallDetailView call={selected} canRetrySummary={canRetrySummary} />
        ) : (
          <NoSelection />
        )}
      </div>

      <aside className="workbench__inspector">
        {selected ? <CallInspector call={selected} /> : null}
      </aside>
    </div>
  )
}

function NoSelection() {
  return (
    <div className="empty" style={{ margin: 'auto' }}>
      <h3>اختر مكالمة</h3>
      <p>سيظهر هنا الحوار الكامل، ومسار التنفيذ، والنتيجة المسجّلة.</p>
    </div>
  )
}

/* ─── detail ─────────────────────────────────────────────────────────────── */

function CallDetailView({ call, canRetrySummary }: { call: CallDetail; canRetrySummary: boolean }) {
  const start = new Date(call.startedAt).getTime()
  const [inspectorOpen, setInspectorOpen] = useState(false)

  return (
    <>
      <header className="detail-head">
        <div>
          <h2 className="mono">{call.callerNumber ?? '—'}</h2>
          <div className="detail-head__sub">
            {call.workspaceName} · {fullDate(call.startedAt)} · {clock(call.startedAt)}
          </div>
        </div>
        <span className="detail-head__status">
          <Pill tone={call.origin === 'live' ? 'signal' : 'neutral'}>
            {call.origin === 'live' ? 'مكالمة حقيقية' : 'بيانات تجريبية'}
          </Pill>
          <Pill tone={call.outcome ? outcomeTone(call.outcome) : statusTone(call.status)}>
            {call.outcome
              ? (CALL_OUTCOME_LABEL[call.outcome] ?? call.outcome)
              : (CALL_STATUS_LABEL[call.status] ?? call.status)}
          </Pill>
          {/* Below ~1400px the inspector column (.workbench__inspector) is
              CSS-hidden — this is the only way to reach outcome/QA/tooling
              detail on a laptop screen or phone. CSS shows it only there. */}
          <button
            type="button"
            className="icon-btn workbench__inspector-trigger"
            onClick={() => setInspectorOpen(true)}
            aria-label="تفاصيل المكالمة: النتيجة والجودة والتشغيل"
            title="تفاصيل المكالمة"
          >
            <PanelRightOpen size={16} aria-hidden="true" />
          </button>
        </span>
      </header>

      <section className="call-brief">
        <div className="call-brief__head">
          <div>
            <span className="detail-section-label">الملخص التشغيلي</span>
            <h3>{call.summary.headline}</h3>
          </div>
          <div className="call-brief__controls">
            <Pill tone={call.summary.source === 'pending' ? 'warn' : 'neutral'}>
              {call.summary.source === 'recorded'
                ? 'محفوظ مع السجل'
                : call.summary.source === 'pending'
                  ? 'غير نهائي'
                  : 'مستخلص من السجل'}
            </Pill>
            <CallIntelligenceStatus
              callId={call.id}
              state={call.intelligence}
              stale={call.intelligenceStale}
              canProcess={
                canRetrySummary &&
                call.origin === 'live' &&
                Boolean(call.endedAt) &&
                call.transcript.length > 0
              }
            />
          </div>
        </div>
        <dl className="call-brief__facts">
          <div>
            <dt>ما احتاجه المتصل</dt>
            <dd>{call.summary.callerNeed ?? 'لم تتوفر معلومات كافية.'}</dd>
          </div>
          <div>
            <dt>ما حدث</dt>
            <dd>{call.summary.resolution}</dd>
          </div>
          <div>
            <dt>الإجراء التالي</dt>
            <dd>{call.summary.nextAction ?? 'لا توجد متابعة مطلوبة.'}</dd>
          </div>
        </dl>

        {call.summary.callerHighlights.length || call.summary.agentHighlights.length ? (
          <div className="call-highlights">
            <div>
              <span>
                <UserRound size={14} /> قال المتصل
              </span>
              {call.summary.callerHighlights.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
            <div>
              <span>
                <MessageSquareText size={14} /> رد الموظف الصوتي
              </span>
              {call.summary.agentHighlights.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          </div>
        ) : null}

        {call.summary.warnings.length ? (
          <ul className="call-brief__warnings">
            {call.summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <RecordingPlayer callId={call.id} status={call.recordingStatus} />

      <section>
        <div className="detail-section-label row" style={{ justifyContent: 'space-between' }}>
          <span>الحوار</span>
          <QuickPronunciationFix
            workspaceId={call.workspaceId}
            workspaceName={call.workspaceName}
          />
        </div>
        <div className="transcript">
          {call.transcript.length === 0 ? (
            <p className="muted">
              لم يصل نص الحوار لهذه المكالمة. السجل الحالي يثبت الاستقبال والقبول فقط.
            </p>
          ) : (
            call.transcript.map((t) => (
              <div key={`${t.role}-${t.at}-${t.text}`} className={`turn turn--${t.role}`}>
                <span className="turn__at">{duration(t.at)}</span>
                <div>
                  <span className="turn__who">{t.role === 'agent' ? 'مُجاوِب' : 'المتصل'}</span>
                  <p className="turn__text">{t.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="detail-section-label">مسار التنفيذ</div>
        <div className="timeline">
          {call.events.length === 0 && call.tools.length === 0 ? (
            <p className="muted">لا توجد أحداث تفصيلية محفوظة لهذه المكالمة بعد.</p>
          ) : null}
          {call.events.map((e) => {
            const at = Math.max(0, Math.round((new Date(e.occurredAt).getTime() - start) / 1000))
            const tone =
              e.type === 'transfer'
                ? 'warn'
                : e.type === 'ended'
                  ? 'good'
                  : e.type === 'abandoned'
                    ? 'bad'
                    : e.type === 'answered'
                      ? 'signal'
                      : 'neutral'
            return (
              <div key={e.id} className="tl-row" data-tone={tone}>
                <span className="tl-row__at">{duration(at)}</span>
                <span className="tl-row__rail" aria-hidden="true">
                  <span className="tl-row__dot" />
                </span>
                <div className="tl-row__body">
                  <span>{EVENT_LABEL[e.type] ?? e.type}</span>
                  {e.latencyMs ? <span className="tl-row__lat">{e.latencyMs}ms</span> : null}
                </div>
              </div>
            )
          })}

          {call.tools.map((t) => {
            const at = Math.max(0, Math.round((new Date(t.executedAt).getTime() - start) / 1000))
            const ok = t.status === 'succeeded'
            return (
              <div key={t.id} className="tl-row" data-tone={ok ? 'good' : 'bad'}>
                <span className="tl-row__at">{duration(at)}</span>
                <span className="tl-row__rail" aria-hidden="true">
                  <span className="tl-row__dot" />
                </span>
                <div className="tl-row__body">
                  <span>{TOOL_LABEL[t.toolName] ?? t.toolName}</span>
                  {ok ? (
                    <Check size={13} style={{ color: 'var(--good)' }} aria-hidden="true" />
                  ) : (
                    <X size={13} style={{ color: 'var(--bad)' }} aria-hidden="true" />
                  )}
                  {t.latencyMs ? <span className="tl-row__lat">{t.latencyMs}ms</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <Sheet
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="تفاصيل المكالمة"
        description="النتيجة، الجودة، والتشغيل — نفس ما يظهر في اللوحة الجانبية على الشاشات الواسعة."
      >
        <div className="stack" style={{ gap: 'var(--s-5)' }}>
          <CallInspector call={call} />
        </div>
      </Sheet>
    </>
  )
}

/* ─── inspector ──────────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="inspector__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function CallInspector({ call }: { call: CallDetail }) {
  const meta = (call.metadata ?? {}) as { customerName?: string; branch?: string }

  return (
    <>
      <div className="inspector__section">
        <h3>النتيجة</h3>
        <dl className="inspector__rows">
          <Row
            label="الحالة"
            value={
              <Pill tone={call.outcome ? outcomeTone(call.outcome) : statusTone(call.status)}>
                {call.outcome
                  ? (CALL_OUTCOME_LABEL[call.outcome] ?? call.outcome)
                  : (CALL_STATUS_LABEL[call.status] ?? call.status)}
              </Pill>
            }
          />
          <Row label="النية" value={call.intent ?? '—'} />
          <Row
            label="المدة"
            value={<span className="mono">{duration(call.durationSeconds)}</span>}
          />
          {meta.branch ? <Row label="الفرع" value={meta.branch} /> : null}
          {call.summary.urgency ? (
            <Row
              label="الأولوية"
              value={
                call.summary.urgency === 'high'
                  ? 'مرتفعة'
                  : call.summary.urgency === 'medium'
                    ? 'متوسطة'
                    : 'عادية'
              }
            />
          ) : null}
          {call.summary.followUpRequired !== null ? (
            <Row label="تحتاج متابعة" value={call.summary.followUpRequired ? 'نعم' : 'لا'} />
          ) : null}
        </dl>
      </div>

      {call.booking ? (
        <div className="inspector__section">
          <h3>الحجز</h3>
          <dl className="inspector__rows">
            <Row label="الخدمة" value={call.booking.service ?? '—'} />
            <Row
              label="الموعد"
              value={
                <span className="mono">
                  {fullDate(call.booking.scheduledAt)} · {clock(call.booking.scheduledAt)}
                </span>
              }
            />
            <Row label="باسم" value={call.booking.customerName ?? '—'} />
            <Row
              label="المرجع"
              value={<span className="mono">{call.booking.externalId ?? '—'}</span>}
            />
          </dl>
        </div>
      ) : null}

      {call.lead ? (
        <div className="inspector__section">
          <h3>عميل محتمل</h3>
          <dl className="inspector__rows">
            <Row label="الاسم" value={call.lead.name ?? '—'} />
            <Row label="الاهتمام" value={call.lead.interest ?? '—'} />
            <Row label="الحالة" value={call.lead.status} />
          </dl>
        </div>
      ) : null}

      <div className="inspector__section">
        <h3>الجودة</h3>
        {call.qa ? (
          <dl className="inspector__rows">
            <Row
              label="الدرجة"
              value={<span className="mono">{call.qa.score ?? '—'} / 100</span>}
            />
            <Row
              label="المراجع"
              value={call.qa.reviewerId ? call.qa.reviewerId : <Pill tone="warn">لم تُراجع</Pill>}
            />
            <div className="inspector__row">
              <dt>الملاحظات</dt>
            </div>
            <div className="queue__flags">
              {(call.qa.flags ?? []).map((f) => (
                <Pill key={f} tone="warn">
                  {f}
                </Pill>
              ))}
            </div>
          </dl>
        ) : (
          <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
            لم تُعلَّم هذه المكالمة للمراجعة.
          </p>
        )}
      </div>

      <div className="inspector__section">
        <h3>التشغيل</h3>
        <dl className="inspector__rows">
          <Row label="الموظف الصوتي" value={call.agentName ?? '—'} />
          <Row label="النسخة" value={<span className="mono">v{call.versionNumber ?? '—'}</span>} />
          <Row
            label="الرقم المستقبِل"
            value={<span className="mono">{call.phoneE164 ?? '—'}</span>}
          />
          <Row
            label="وجهة التحويل"
            value={<span className="mono">{call.transferDestination ?? '—'}</span>}
          />
          <Row
            label="نوع السجل"
            value={call.origin === 'live' ? 'مكالمة حقيقية' : 'بيانات تجريبية'}
          />
        </dl>
      </div>
    </>
  )
}
