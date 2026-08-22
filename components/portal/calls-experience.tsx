import { CalendarCheck, MessageSquareText, PhoneCall, UserRound } from 'lucide-react'
import Link from 'next/link'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CALL_STATUS_LABEL,
  clock,
  duration,
  fullDate,
  maskPhone,
  outcomeTone,
  relative,
  statusTone,
} from '@/lib/format'
import type { getPortalCallDetail, getPortalCalls } from '@/server/data/portal'

type CallRow = Awaited<ReturnType<typeof getPortalCalls>>[number]
type CallDetail = NonNullable<Awaited<ReturnType<typeof getPortalCallDetail>>>

function callLabel(call: { outcome: string | null; status: string }) {
  return call.outcome
    ? (CALL_OUTCOME_LABEL[call.outcome] ?? call.outcome)
    : (CALL_STATUS_LABEL[call.status] ?? call.status)
}

function callTone(call: { outcome: string | null; status: string }) {
  return call.outcome ? outcomeTone(call.outcome) : statusTone(call.status)
}

export function PortalCallsExperience({
  rows,
  selected,
}: {
  rows: CallRow[]
  selected: CallDetail | null
}) {
  if (rows.length === 0) {
    return (
      <div className="empty portal-calls-empty">
        <PhoneCall size={24} aria-hidden="true" />
        <h3>لا توجد مكالمات حقيقية بعد</h3>
        <p>ستظهر هنا تفاصيل المكالمات فور بدء استقبالها على رقمكم.</p>
      </div>
    )
  }

  return (
    <div className="portal-call-workbench">
      <nav className="portal-call-list" aria-label="قائمة المكالمات">
        <div className="portal-call-list__head">
          <span>أحدث المكالمات</span>
          <span className="mono">{rows.length}</span>
        </div>
        {rows.map((call) => (
          <Link
            key={call.id}
            href={`/portal/calls?call=${encodeURIComponent(call.id)}`}
            className={`portal-call-row${selected?.id === call.id ? ' is-active' : ''}`}
            aria-current={selected?.id === call.id ? 'page' : undefined}
          >
            <span className="portal-call-row__top">
              <strong className="mono">{maskPhone(call.callerNumber)}</strong>
              <span>{duration(call.durationSeconds)}</span>
            </span>
            <span className="portal-call-row__reason">
              {call.intent ?? 'سبب المكالمة غير محدد'}
            </span>
            <span className="portal-call-row__meta">
              <Pill tone={callTone(call)}>{callLabel(call)}</Pill>
              <span>{relative(call.startedAt)}</span>
            </span>
          </Link>
        ))}
      </nav>

      <section className="portal-call-detail" aria-label="تفاصيل المكالمة">
        {selected ? <PortalCallDetail call={selected} /> : null}
      </section>
    </div>
  )
}

function PortalCallDetail({ call }: { call: CallDetail }) {
  return (
    <>
      <header className="portal-call-detail__head">
        <div>
          <span className="portal-call-detail__eyebrow">{fullDate(call.startedAt)}</span>
          <h2 className="mono">{maskPhone(call.callerNumber)}</h2>
          <p>
            {clock(call.startedAt)} · {duration(call.durationSeconds)}
            {call.branch ? ` · ${call.branch}` : ''}
          </p>
        </div>
        <Pill tone={callTone(call)}>{callLabel(call)}</Pill>
      </header>

      <div className="portal-call-answer">
        <span className="portal-call-detail__eyebrow">خلاصة المكالمة</span>
        <h3>{call.summary.headline}</h3>
        <dl>
          <div>
            <dt>ماذا احتاج المتصل؟</dt>
            <dd>{call.summary.callerNeed ?? 'لم تتوفر معلومات كافية.'}</dd>
          </div>
          <div>
            <dt>ماذا حدث؟</dt>
            <dd>{call.summary.resolution}</dd>
          </div>
          <div>
            <dt>ماذا بعد؟</dt>
            <dd>{call.summary.nextAction ?? 'لا توجد متابعة مطلوبة.'}</dd>
          </div>
        </dl>
      </div>

      {call.booking || call.lead ? (
        <div className="portal-call-proof">
          {call.booking ? (
            <span>
              <CalendarCheck size={17} aria-hidden="true" />
              {call.booking.service
                ? `حجز مؤكد: ${call.booking.service}`
                : 'حجز مؤكد مرتبط بالمكالمة'}
            </span>
          ) : null}
          {call.lead ? (
            <span>
              <UserRound size={17} aria-hidden="true" />
              {call.lead.interest
                ? `متابعة مؤكدة: ${call.lead.interest}`
                : 'فرصة متابعة مرتبطة بالمكالمة'}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="portal-call-conversation">
        <div className="portal-call-conversation__head">
          <MessageSquareText size={17} aria-hidden="true" />
          <h3>الحوار</h3>
        </div>
        {call.transcript.length === 0 ? (
          <p className="muted">نص الحوار غير متاح لهذه المكالمة بعد.</p>
        ) : (
          <div className="portal-transcript">
            {call.transcript.map((turn) => (
              <div key={`${turn.role}-${turn.at}-${turn.text}`} className="portal-transcript__turn">
                <span className="mono">{duration(turn.at)}</span>
                <div>
                  <strong>{turn.role === 'caller' ? 'المتصل' : 'مُجاوِب'}</strong>
                  <p>{turn.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
