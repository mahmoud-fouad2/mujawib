'use client'

import { Download, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { CRM_RANGE_LABEL } from '@/lib/format'

export type FilterOption = { value: string; label: string }

function csvField(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function hrefFor(input: {
  basePath: string
  search: string
  status: string
  range: string
  client?: string | undefined
}) {
  const params = new URLSearchParams()
  if (input.client) params.set('client', input.client)
  if (input.search.trim()) params.set('q', input.search.trim())
  if (input.status && input.status !== 'all') params.set('status', input.status)
  if (input.range && input.range !== 'all') params.set('range', input.range)
  const qs = params.toString()
  return `${input.basePath}${qs ? `?${qs}` : ''}`
}

export function ConsoleSearchFilters({
  basePath,
  search,
  status,
  range,
  client,
  searchPlaceholder,
  statusOptions,
  rangeOptions = Object.entries(CRM_RANGE_LABEL).map(([value, label]) => ({ value, label })),
  children,
}: {
  basePath: string
  search: string
  status: string
  range: string
  client?: string | undefined
  searchPlaceholder: string
  statusOptions: FilterOption[]
  rangeOptions?: FilterOption[]
  children?: ReactNode
}) {
  const router = useRouter()
  const [query, setQuery] = useState(search)

  useEffect(() => setQuery(search), [search])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === search) return
    const id = window.setTimeout(() => {
      router.replace(hrefFor({ basePath, search: trimmed, status, range, client }), {
        scroll: false,
      })
    }, 350)
    return () => window.clearTimeout(id)
  }, [basePath, client, query, range, router, search, status])

  return (
    <div className="console-table-toolbar">
      <div className="console-table-toolbar__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="بحث"
        />
      </div>
      <select
        className="input"
        value={status}
        onChange={(event) =>
          router.replace(
            hrefFor({ basePath, search: query, status: event.target.value, range, client }),
            { scroll: false },
          )
        }
        aria-label="فلترة حسب الحالة"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className="input"
        value={range}
        onChange={(event) =>
          router.replace(
            hrefFor({ basePath, search: query, status, range: event.target.value, client }),
            { scroll: false },
          )
        }
        aria-label="فلترة حسب التاريخ"
      >
        {rangeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {children}
    </div>
  )
}

export function CsvExportButton({
  filename,
  headers,
  rows,
  label = 'تصدير CSV',
}: {
  filename: string
  headers: string[]
  rows: unknown[][]
  label?: string
}) {
  function download() {
    const csv = `\uFEFF${[
      headers.map(csvField).join(','),
      ...rows.map((row) => row.map(csvField).join(',')),
    ].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" className="btn btn--quiet btn--sm" onClick={download}>
      <Download size={15} aria-hidden="true" />
      {label}
    </button>
  )
}
