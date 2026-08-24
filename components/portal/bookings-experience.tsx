'use client'

import { Download, MessageSquare, Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { clock, fullDate, maskPhone } from '@/lib/format'
import type { getPortalBookings } from '@/server/data/portal'

type BookingRow = Awaited<ReturnType<typeof getPortalBookings>>[number]

const FILTER_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'confirmed', label: 'المؤكدة' },
  { id: 'upcoming', label: 'القادمة' },
  { id: 'cancelled', label: 'الملغاة' },
] as const

export function PortalBookingsExperience({ rows }: { rows: BookingRow[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const filteredRows = useMemo(() => {
    const now = Date.now()
    return rows.filter((b) => {
      const isUpcoming = b.scheduledAt && new Date(b.scheduledAt).getTime() > now

      const matchFilter =
        filter === 'all' ||
        (filter === 'confirmed' && b.status === 'confirmed') ||
        (filter === 'upcoming' && isUpcoming && b.status === 'confirmed') ||
        (filter === 'cancelled' && b.status === 'cancelled')

      const q = search.trim().toLowerCase()
      const meta = (b.metadata ?? {}) as { branch?: string }
      const matchSearch =
        !q ||
        Boolean(b.customerName?.toLowerCase().includes(q)) ||
        Boolean(b.customerPhone?.toLowerCase().includes(q)) ||
        Boolean(b.service?.toLowerCase().includes(q)) ||
        Boolean(meta.branch?.toLowerCase().includes(q))

      return matchFilter && matchSearch
    })
  }, [rows, filter, search])

  const handleExportCsv = () => {
    const headers = ['العميل', 'الجوال', 'الخدمة', 'تاريخ الموعد', 'الوقت', 'الفرع', 'الحالة']
    const csvLines = filteredRows.map((b) => {
      const meta = (b.metadata ?? {}) as { branch?: string }
      return [
        `"${(b.customerName ?? '').replace(/"/g, '""')}"`,
        b.customerPhone ?? '',
        `"${(b.service ?? '').replace(/"/g, '""')}"`,
        fullDate(b.scheduledAt),
        clock(b.scheduledAt),
        `"${(meta.branch ?? '').replace(/"/g, '""')}"`,
        b.status === 'confirmed' ? 'مؤكد' : 'ملغى',
      ]
    })
    const csvContent =
      '\uFEFF' + [headers.join(','), ...csvLines.map((l) => l.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mujawib-bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="لا حجوزات بعد"
        body="عندما ينجز مُجاوِب حجزًا داخل تقويمك سيظهر هنا بتفاصيله الكاملة مع إمكانية المتابعة."
      />
    )
  }

  return (
    <div>
      {/* Search & Filter Header Bar */}
      <div
        style={{
          padding: 'var(--s-3)',
          borderBlockEnd: '1px solid var(--border)',
          background: 'var(--surface-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-3)',
        }}
      >
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="field" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  insetInlineStart: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                className="input"
                style={{ paddingInlineStart: '32px', height: '36px', fontSize: 'var(--step--1)' }}
                placeholder="بحث باسم العميل، الخدمة، الفرع، أو الجوال…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn--quiet btn--sm"
            style={{ height: '36px', gap: '6px' }}
            title="تصدير الحجوزات إلى ملف Excel / CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span>تصدير الحجوزات (CSV)</span>
          </button>
        </div>

        <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`filter-chip${filter === tab.id ? ' is-active' : ''}`}
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="empty" style={{ padding: 'var(--s-5)' }}>
          <p>لا توجد حجوزات تطابق البحث المحدد.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>العميل</th>
                <th>الجوال</th>
                <th>الخدمة</th>
                <th>الموعد</th>
                <th>الوقت</th>
                <th>الفرع</th>
                <th>الحالة</th>
                <th>تواصل سريع</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((b) => {
                const meta = (b.metadata ?? {}) as { branch?: string }
                const cleanPhone = b.customerPhone ? b.customerPhone.replace(/\D/g, '') : ''
                const confirmMsg = encodeURIComponent(
                  `مرحباً ${b.customerName ? `أستاذ/ة ${b.customerName}` : 'بك'}، نود تأكيد موعدك لخدمة (${b.service ?? 'المحددة'}) يوم ${fullDate(b.scheduledAt)} الساعة ${clock(b.scheduledAt)}.${meta.branch ? ` الفرع: ${meta.branch}` : ''}`,
                )
                const waUrl = `https://wa.me/${cleanPhone}?text=${confirmMsg}`
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.customerName ?? '—'}</td>
                    <td className="mono">{maskPhone(b.customerPhone)}</td>
                    <td className="muted">{b.service ?? '—'}</td>
                    <td className="muted">{fullDate(b.scheduledAt)}</td>
                    <td className="mono">{clock(b.scheduledAt)}</td>
                    <td className="muted">{meta.branch ?? '—'}</td>
                    <td>
                      <Pill tone={b.status === 'confirmed' ? 'good' : 'bad'}>
                        {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                      </Pill>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 'var(--s-1)' }}>
                        {cleanPhone ? (
                          <>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--quiet btn--sm"
                              title="إرسال رسالة تأكيد الحجز وموقع الفرع عبر واتساب"
                              aria-label="واتساب"
                            >
                              <MessageSquare size={14} aria-hidden="true" />
                            </a>
                            <a
                              href={`tel:${b.customerPhone}`}
                              className="btn btn--quiet btn--sm"
                              title="اتصال مباشر بالعميل"
                              aria-label="اتصال"
                            >
                              <Phone size={14} aria-hidden="true" />
                            </a>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
