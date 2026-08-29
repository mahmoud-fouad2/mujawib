'use client'

import { Download, MessageSquare, Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { clock, fullDate, maskPhone, num, relative } from '@/lib/format'
import type { getPortalCustomers } from '@/server/data/portal'

type CustomerRow = Awaited<ReturnType<typeof getPortalCustomers>>['rows'][number]

export function PortalCustomersExperience({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState('')

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((c) => {
      const matchName = Boolean(c.name?.toLowerCase().includes(q))
      const matchPhone = Boolean(c.phone?.toLowerCase().includes(q))
      const matchTags = Boolean((c.tags ?? []).some((t) => t.toLowerCase().includes(q)))
      return matchName || matchPhone || matchTags
    })
  }, [rows, search])

  const handleExportCsv = () => {
    const headers = ['الاسم', 'الجوال', 'عدد المكالمات', 'عدد الحجوزات', 'الوسوم', 'آخر اتصال']
    const csvLines = filteredRows.map((c) => [
      `"${(c.name ?? '').replace(/"/g, '""')}"`,
      c.phone ?? '',
      c.calls,
      c.bookings,
      `"${(c.tags ?? []).join('، ').replace(/"/g, '""')}"`,
      c.lastCallAt ? `${fullDate(c.lastCallAt)} ${clock(c.lastCallAt)}` : '—',
    ])
    const csvContent = `\uFEFF${[headers.join(','), ...csvLines.map((l) => l.join(','))].join('\n')}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mujawib-callers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="لا متصلين مسجلين بعد"
        body="عندما يستقبل مُجاوِب مكالمات منشأتك ستظهر بيانات المتصلين وتكرار زياراتهم هنا تلقائيًا."
      />
    )
  }

  return (
    <div>
      {/* Search & Export Toolbar */}
      <div className="portal-toolbar">
        <div className="portal-toolbar__row">
          <div className="portal-toolbar__search">
            <Search size={15} aria-hidden="true" />
            <input
              className="input"
              placeholder="بحث بالاسم أو رقم الجوال أو الوسم…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn--quiet btn--sm"
            style={{ height: '38px' }}
            title="تصدير قائمة المتصلين إلى ملف Excel / CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span>تصدير المتصلين (CSV)</span>
          </button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="empty-box">
          <p className="empty-box__title">لا توجد نتائج مطابقة</p>
          <p className="empty-box__desc">
            لم يتم العثور على أي متصلين يطابقون عبارة البحث المكتوبة.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table table--rows">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الجوال</th>
                <th>المكالمات</th>
                <th>الحجوزات</th>
                <th>الوسوم</th>
                <th>آخر اتصال</th>
                <th>تواصل سريع</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((c) => {
                const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : ''
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name ?? '—'}</td>
                    <td className="mono">{maskPhone(c.phone)}</td>
                    <td className="mono">{num(c.calls)}</td>
                    <td className="mono">{num(c.bookings)}</td>
                    <td>
                      <span className="queue__flags">
                        {(c.tags ?? []).map((t) => (
                          <Pill key={t} tone="signal">
                            {t}
                          </Pill>
                        ))}
                      </span>
                    </td>
                    <td className="muted">{relative(c.lastCallAt)}</td>
                    <td>
                      <span className="row" style={{ gap: 'var(--s-1)' }}>
                        {cleanPhone ? (
                          <>
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--quiet btn--sm"
                              title="مراسلة المتصل عبر واتساب"
                              aria-label="واتساب"
                            >
                              <MessageSquare size={14} aria-hidden="true" />
                            </a>
                            <a
                              href={`tel:${c.phone}`}
                              className="btn btn--quiet btn--sm"
                              title="اتصال مباشر بالمتصل"
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
