'use client'

import { CalendarX, Download, MessageSquare, Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Confirm } from '@/components/ui/overlays'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { useAction } from '@/components/ui/row-actions'
import { clock, fullDate, maskPhone } from '@/lib/format'
import { cancelBooking } from '@/server/actions/portal'
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
    const csvContent = `\uFEFF${[headers.join(','), ...csvLines.map((l) => l.join(','))].join('\n')}`
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
      <div className="portal-toolbar">
        <div className="portal-toolbar__row">
          <div className="portal-toolbar__search">
            <Search size={15} aria-hidden="true" />
            <input
              className="input"
              placeholder="بحث باسم العميل، الخدمة، الفرع، أو الجوال…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn--quiet btn--sm"
            style={{ height: '38px', gap: '6px' }}
            title="تصدير الحجوزات إلى ملف Excel / CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span>تصدير الحجوزات (CSV)</span>
          </button>
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

      {filteredRows.length === 0 ? (
        <div className="empty-box">
          <p className="empty-box__title">لا توجد نتائج مطابقة</p>
          <p className="empty-box__desc">
            لم يتم العثور على أي حجوزات تطابق عبارة البحث أو الفلتر المختار.
          </p>
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
                        {b.status === 'confirmed' ? (
                          <BookingCancelButton id={b.id} customerName={b.customerName} />
                        ) : null}
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

function BookingCancelButton({ id, customerName }: { id: string; customerName: string | null }) {
  const [confirm, setConfirm] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="btn btn--quiet btn--sm"
        title="إلغاء الحجز"
        aria-label="إلغاء الحجز"
      >
        <CalendarX size={14} aria-hidden="true" />
      </button>

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          run(
            () => cancelBooking(id),
            () => setConfirm(false),
          )
        }
        title={`إلغاء حجز ${customerName ?? 'هذا العميل'}؟`}
        body="سيُنقل الحجز إلى قائمة الحجوزات الملغاة. هذا الإجراء لا يُلغي الموعد في تقويمك الخارجي تلقائيًا — تأكد من ذلك يدويًا إذا لزم."
        confirmLabel="ألغِ الحجز"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
