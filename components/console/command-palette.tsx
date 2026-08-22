'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { canOperator } from '@/lib/access'
import { CONSOLE_NAV_FLAT } from '@/lib/console-nav'

export type CommandIndex = {
  clients: { name: string; slug: string }[]
  agents: { name: string; workspaceName: string }[]
  numbers: { e164: string; workspaceName: string }[]
}

type Entry = { group: string; label: string; hint: string; href: string }

/** Subsequence match — "alfa" finds "Alfa Clinic", "ألفا" finds "عيادات ألفا". */
function matches(haystack: string, needle: string) {
  if (!needle) return true
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h.includes(n)) return true
  let i = 0
  for (const ch of h) {
    if (ch === n[i]) i++
    if (i === n.length) return true
  }
  return false
}

export function CommandPalette({
  open,
  onClose,
  index,
  role,
}: {
  open: boolean
  onClose: () => void
  index: CommandIndex
  role: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const entries = useMemo<Entry[]>(
    () => [
      ...CONSOLE_NAV_FLAT.filter(
        (item) =>
          (!item.ownerOnly || role === 'owner') &&
          (!item.requiredPermission || canOperator(role, item.requiredPermission)),
      ).map((n) => ({
        group: 'التنقل',
        label: n.label,
        hint: n.href,
        href: n.href,
      })),
      ...index.clients.map((c) => ({
        group: 'العملاء',
        label: c.name,
        hint: c.slug,
        href: `/console/clients/${c.slug}`,
      })),
      ...index.agents.map((a) => ({
        group: 'الموظفون الصوتيون',
        label: a.name,
        hint: a.workspaceName,
        href: '/console/agents',
      })),
      ...index.numbers.map((p) => ({
        group: 'الأرقام',
        label: p.e164,
        hint: p.workspaceName,
        href: '/console/phone',
      })),
    ],
    [index, role],
  )

  const results = useMemo(() => {
    const q = query.trim()
    const filtered = entries.filter(
      (e) =>
        matches(e.label, q) ||
        matches(e.hint, q) ||
        CONSOLE_NAV_FLAT.some(
          (n) =>
            (!n.ownerOnly || role === 'owner') &&
            (!n.requiredPermission || canOperator(role, n.requiredPermission)) &&
            n.href === e.href &&
            n.keywords.some((k) => matches(k, q)),
        ),
    )
    return filtered.slice(0, 24)
  }, [entries, query, role])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Focus after the dialog paints.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      }
      if (e.key === 'Enter') {
        const target = results[cursor]
        if (target) {
          onClose()
          router.push(target.href)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, cursor, onClose, router])

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="palette__scrim" role="presentation">
      {/* Focusable close target behind the dialog — Escape also closes. */}
      <button
        type="button"
        className="palette__scrim-close"
        aria-label="إغلاق البحث"
        onClick={onClose}
      />
      <div className="palette" role="dialog" aria-modal="true" aria-label="البحث والتنقل">
        <div className="palette__input">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            placeholder="ابحث عن مكالمة أو عميل أو رقم…"
            aria-label="بحث"
          />
        </div>

        <div className="palette__results">
          {results.length === 0 ? (
            <p className="palette__group">لا نتائج مطابقة</p>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null
              lastGroup = r.group
              return (
                <div key={`${r.group}-${r.href}-${r.label}`}>
                  {header ? <div className="palette__group">{header}</div> : null}
                  <button
                    type="button"
                    className="palette__item"
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      onClose()
                      router.push(r.href)
                    }}
                  >
                    <span>{r.label}</span>
                    <small>{r.hint}</small>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
