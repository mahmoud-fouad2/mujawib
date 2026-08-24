'use client'

import { Download, MessageSquare, Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { maskPhone, num, relative } from '@/lib/format'
import type { getPortalCustomers } from '@/server/data/portal'

type CustomerRow = Awaited<ReturnType<typeof getPortalCustomers>>[number]

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
      relative(c.lastCallAt),
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
      <div
        style={{
          padding: 'var(--s-3)',
          borderBlockEnd: '1px solid var(--border)',
          background: 'var(--surface-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--s-3)',
          flexWrap: 'wrap',
        }}
      >
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
              placeholder="بحث بالاسم أو رقم الجوال أو الوسم…"
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
          title="تصدير قائمة المتصلين إلى ملف Excel / CSV"
        >
          <Download size={14} aria-hidden="true" />
          <span>تصدير المتصلين (CSV)</span>
        </button>
      </div>

      {filteredRows.length === 0 ? (
        <div className="empty" style={{ padding: 'var(--s-5)' }}>
          <p>لا يوجد متصلون يطابقون عبارة البحث.</p>
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
