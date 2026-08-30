'use client'

import {
  CalendarCheck,
  Check,
  Copy,
  Download,
  MessageSquare,
  MessageSquareText,
  Phone,
  PhoneCall,
  Search,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { RecordingPlayer } from '@/components/calls/recording-player'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/primitives'
import {
  CALL_OUTCOME_LABEL,
  CALL_STATUS_LABEL,
  CRM_RANGE_LABEL,
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

const FILTER_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'booking', label: 'حجوزات' },
  { id: 'callback', label: 'معاودة اتصال' },
  { id: 'transfer', label: 'محوّلة' },
  { id: 'resolved', label: 'أُنجزت' },
] as const

const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  today: 1,
  week: 7,
  month: 30,
  year: 365,
}

export function PortalCallsExperience({
  rows,
  selected,
}: {
  rows: CallRow[]
  selected: CallDetail | null
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [range, setRange] = useState<string>('all')

  const filteredRows = useMemo(() => {
    const now = Date.now()
    const rangeDays = RANGE_DAYS[range] ?? null
    const rangeCutoff = rangeDays ? now - rangeDays * 24 * 60 * 60 * 1000 : null

    return rows.filter((r) => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'booking' && r.outcome === 'booking') ||
        (filter === 'callback' && r.outcome === 'callback') ||
        (filter === 'transfer' && (r.outcome === 'transfer' || r.status === 'transferred')) ||
        (filter === 'resolved' && (r.outcome === 'resolved' || r.outcome === 'lead'))

      const matchRange = !rangeCutoff || new Date(r.startedAt).getTime() >= rangeCutoff

      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        Boolean(r.callerNumber?.toLowerCase().includes(q)) ||
        Boolean(r.intent?.toLowerCase().includes(q)) ||
        Boolean(r.outcome?.toLowerCase().includes(q))

      return matchFilter && matchRange && matchSearch
    })
  }, [rows, filter, range, search])

  if (rows.length === 0) {
    return (
      <div className="empty portal-calls-empty">
        <PhoneCall size={24} aria-hidden="true" />
        <h3>لا توجد مكالمات حقيقية بعد</h3>
        <p>ستظهر هنا تفاصيل المكالمات فور بدء استقبالها على رقمكم.</p>
      </div>
    )
  }

  const handleExportCsv = () => {
    const headers = [
      'التاريخ',
      'الوقت',
      'رقم المتصل',
      'الموضوع / النية',
      'النتيجة',
      'المدة (ثواني)',
    ]
    const csvLines = filteredRows.map((r) => [
      fullDate(r.startedAt),
      clock(r.startedAt),
      r.callerNumber ?? '',
      `"${(r.intent ?? '').replace(/"/g, '""')}"`,
      `"${(callLabel(r) ?? '').replace(/"/g, '""')}"`,
      r.durationSeconds ?? 0,
    ])
    const csvContent = `\uFEFF${[headers.join(','), ...csvLines.map((l) => l.join(','))].join('\n')}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mujawib-calls-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="portal-call-workbench">
      <nav className="portal-call-list" aria-label="قائمة المكالمات">
        {/* Search & Filter Bar */}
        <div className="portal-toolbar">
          <div className="portal-toolbar__row">
            <div className="portal-toolbar__search">
              <Search size={14} aria-hidden="true" />
              <input
                className="input"
                placeholder="بحث برقم المتصل أو السبب…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{ height: '38px', fontSize: 'var(--step--1)', minInlineSize: 140 }}
              aria-label="فلترة حسب تاريخ المكالمة"
            >
              {Object.entries(CRM_RANGE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="portal-toolbar__filters">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`filter-chip${filter === tab.id ? ' is-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="portal-call-list__head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span>المكالمات</span>
            <span
              className="mono"
              style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}
            >
              ({filteredRows.length})
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn--quiet btn--sm"
            style={{ padding: '2px 8px', gap: '4px' }}
            title="تصدير المكالمات إلى ملف Excel / CSV"
          >
            <Download size={13} aria-hidden="true" />
            <span>تصدير</span>
          </button>
        </div>

        {filteredRows.length === 0 ? (
          <div className="empty-box">
            <p className="empty-box__title">لا توجد نتائج مطابقة</p>
            <p className="empty-box__desc">
              لم يتم العثور على أي مكالمات تطابق عبارة البحث أو الفلتر المختار.
            </p>
          </div>
        ) : (
          filteredRows.map((call) => (
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
          ))
        )}
      </nav>

      <section className="portal-call-detail" aria-label="تفاصيل المكالمة">
        {selected ? <PortalCallDetail call={selected} /> : null}
      </section>
    </div>
  )
}

function PortalCallDetail({ call }: { call: CallDetail }) {
  const [copied, setCopied] = useState(false)
  const rawPhone = (call.callerNumber ?? '').replace(/[^\d+]/g, '')
  const whatsappUrl = `https://wa.me/${rawPhone.replace('+', '')}`

  const copySummary = () => {
    const text = `خلاصة مكالمة مُجاوِب:
المتصل: ${call.callerNumber ?? '—'}
النتيجة: ${callLabel(call)}
ما حدث: ${call.summary.resolution}
الخطوة التالية: ${call.summary.nextAction ?? 'لا توجد'}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          <Pill tone={callTone(call)}>{callLabel(call)}</Pill>
          <Button size="sm" variant="quiet" onClick={copySummary} title="نسخ ملخص المكالمة">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'تم النسخ' : 'نسخ الملخص'}
          </Button>
        </div>
      </header>

      {/* Quick Action Bar for Customer Outreach */}
      <div
        className="card-sub"
        style={{
          background: 'var(--surface-elevated)',
          padding: 'var(--s-3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--s-2)',
          marginBlockEnd: 'var(--s-4)',
        }}
      >
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 500 }}>إجراء سريع مع المتصل:</span>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn--sm">
            <MessageSquare size={14} aria-hidden="true" />
            مراسلة عبر واتساب
          </a>
          <a href={`tel:${rawPhone}`} className="btn btn--sm btn--primary">
            <Phone size={14} aria-hidden="true" />
            معاودة الاتصال
          </a>
        </div>
      </div>

      <div className="portal-call-answer">
        <span className="portal-call-detail__eyebrow">خلاصة المكالمة التشغيلية</span>
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

      <RecordingPlayer callId={call.id} status={call.recordingStatus} />

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
