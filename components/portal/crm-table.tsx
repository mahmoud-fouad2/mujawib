'use client'

import { Columns3, Download, MessageSquare, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CsvExportButton } from '@/components/console/table-tools'
import { Section, SummaryBar } from '@/components/console/ui'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  CRM_RANGE_LABEL,
  CRM_SOURCE_LABEL,
  CRM_STATUS_LABEL,
  crmStatusTone,
  fullDate,
  num,
  relative,
} from '@/lib/format'
import {
  createCustomer,
  deleteCustomer,
  deleteCustomersBulk,
  updateCustomer,
} from '@/server/actions/crm'
import type { CrmCustomerRow, CrmDateRange, CrmStatusFilter } from '@/server/data/crm'

type Filters = { search: string; status: CrmStatusFilter; range: CrmDateRange }
type Summary = { total: number; leads: number; active: number; fromCalls: number }

/* ─── url filters ────────────────────────────────────────────────────────── */

function filterQuery(f: Filters) {
  const params = new URLSearchParams()
  if (f.search) params.set('q', f.search)
  if (f.status !== 'all') params.set('status', f.status)
  if (f.range !== 'all') params.set('range', f.range)
  return params.toString()
}

function hrefFor(f: Filters) {
  const qs = filterQuery(f)
  return `/portal/customers${qs ? `?${qs}` : ''}`
}

/* ─── column visibility ──────────────────────────────────────────────────── */

type ColumnKey =
  | 'email'
  | 'status'
  | 'tags'
  | 'notes'
  | 'source'
  | 'calls'
  | 'lastCallAt'
  | 'createdAt'

const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'status', label: 'الحالة' },
  { key: 'tags', label: 'الوسوم' },
  { key: 'calls', label: 'المكالمات' },
  { key: 'lastCallAt', label: 'آخر اتصال' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'source', label: 'المصدر' },
  { key: 'notes', label: 'ملاحظات' },
  { key: 'createdAt', label: 'أُضيف في' },
]

const DEFAULT_COLUMNS: ColumnKey[] = ['status', 'tags', 'calls', 'lastCallAt']

function columnStorageKey(workspaceId: string) {
  return `mujawib.crm.columns.${workspaceId}`
}

/** Per-browser preference, not account data — localStorage is the right layer. */
function useVisibleColumns(workspaceId: string) {
  const [visible, setVisible] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS))

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(columnStorageKey(workspaceId))
      if (!raw) return
      const saved: unknown = JSON.parse(raw)
      if (!Array.isArray(saved)) return
      const known = new Set(OPTIONAL_COLUMNS.map((c) => c.key))
      setVisible(new Set(saved.filter((k): k is ColumnKey => known.has(k))))
    } catch {
      // Private browsing or a corrupted value — the defaults already apply.
    }
  }, [workspaceId])

  function toggle(key: ColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        window.localStorage.setItem(columnStorageKey(workspaceId), JSON.stringify([...next]))
      } catch {
        // Nothing to persist to — the in-memory choice still holds for this visit.
      }
      return next
    })
  }

  return { visible, toggle }
}

function ColumnPicker({
  visible,
  onToggle,
}: {
  visible: Set<ColumnKey>
  onToggle: (key: ColumnKey) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="row-actions" ref={ref}>
      <Button
        size="sm"
        leading={<Columns3 size={15} />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="اختر الأعمدة الظاهرة"
      >
        الأعمدة
      </Button>
      {open ? (
        <div className="row-actions__menu">
          {OPTIONAL_COLUMNS.map((c) => (
            <label key={c.key} className="check-row">
              <input
                type="checkbox"
                checked={visible.has(c.key)}
                onChange={() => onToggle(c.key)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ─── create / edit ──────────────────────────────────────────────────────── */

type FormState = {
  name: string
  phone: string
  email: string
  status: string
  tagsText: string
  notes: string
}

function toFormState(customer?: CrmCustomerRow): FormState {
  return {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    status: customer?.status ?? 'lead',
    tagsText: customer?.tags.join('، ') ?? '',
    notes: customer?.notes ?? '',
  }
}

function parseTags(text: string): string[] {
  return text
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function CustomerFormSheet({
  workspaceId,
  customer,
  open,
  onClose,
}: {
  workspaceId: string
  customer?: CrmCustomerRow
  open: boolean
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(customer))
  const { run, pending } = useAction()
  const set = (k: keyof FormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }))

  // Re-seeds from the current row (or blank, for "add") whenever the sheet opens.
  // The sheet's own scrim blocks interaction with the rest of the page while
  // open, so `customer` only changes here as a result of this same form's
  // save closing it first — never mid-edit under the user.
  useEffect(() => {
    if (open) setForm(toFormState(customer))
  }, [open, customer])

  const isEdit = Boolean(customer)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? `تعديل ${customer?.name ?? customer?.phone}` : 'إضافة عميل'}
      description="الاسم والجوال هما الحد الأدنى — أضف الباقي متى توفر."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || form.phone.trim().length < 7}
            onClick={() =>
              run(() => {
                const payload = {
                  workspaceId,
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  email: form.email.trim(),
                  status: form.status as 'lead' | 'active' | 'inactive',
                  tags: parseTags(form.tagsText),
                  notes: form.notes.trim(),
                }
                return isEdit && customer
                  ? updateCustomer({ id: customer.id, ...payload })
                  : createCustomer(payload)
              }, onClose)
            }
          >
            {pending ? 'جارٍ الحفظ…' : isEdit ? 'احفظ' : 'أضف'}
          </Button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="cust-name">الاسم</label>
        <input
          id="cust-name"
          className="input"
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="أحمد سالم"
        />
      </div>
      <div className="field">
        <label htmlFor="cust-phone">الجوال</label>
        <input
          id="cust-phone"
          className="input mono"
          value={form.phone}
          onChange={(e) => set('phone')(e.target.value)}
          placeholder="+966501234567"
        />
      </div>
      <div className="field">
        <label htmlFor="cust-email">البريد الإلكتروني</label>
        <input
          id="cust-email"
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          placeholder="اختياري"
        />
      </div>
      <div className="field">
        <label htmlFor="cust-status">الحالة</label>
        <select
          id="cust-status"
          className="input"
          value={form.status}
          onChange={(e) => set('status')(e.target.value)}
        >
          <option value="lead">عميل محتمل</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="cust-tags">الوسوم</label>
        <input
          id="cust-tags"
          className="input"
          value={form.tagsText}
          onChange={(e) => set('tagsText')(e.target.value)}
          placeholder="VIP، متابعة"
        />
        <span className="field__hint">افصل بين الوسوم بفاصلة.</span>
      </div>
      <div className="field">
        <label htmlFor="cust-notes">ملاحظات</label>
        <textarea
          id="cust-notes"
          className="input"
          value={form.notes}
          onChange={(e) => set('notes')(e.target.value)}
          placeholder="اختياري"
        />
      </div>
    </Sheet>
  )
}

function AddCustomerButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        أضف عميلًا
      </Button>
      <CustomerFormSheet workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function CustomerRowActions({
  workspaceId,
  customer,
}: {
  workspaceId: string
  customer: CrmCustomerRow
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>
          عدّل
        </RowAction>
        <RowAction icon={<Trash2 size={15} />} tone="danger" onClick={() => setConfirmOpen(true)}>
          احذف
        </RowAction>
      </RowActions>

      <CustomerFormSheet
        workspaceId={workspaceId}
        customer={customer}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <Confirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() =>
          run(
            () => deleteCustomer({ id: customer.id, workspaceId }),
            () => setConfirmOpen(false),
          )
        }
        title={`حذف ${customer.name ?? customer.phone}؟`}
        body="سيُحذف هذا العميل نهائيًا من قائمة العملاء. سجل مكالماته لا يتأثر."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

/* ─── table ───────────────────────────────────────────────────────────────── */

export function CrmTable({
  workspaceId,
  customers,
  summary,
  filters,
  canManage,
}: {
  workspaceId: string
  customers: CrmCustomerRow[]
  summary: Summary
  filters: Filters
  canManage: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState(filters.search)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const { visible, toggle } = useVisibleColumns(workspaceId)
  const { run, pending } = useAction()

  useEffect(() => setSearch(filters.search), [filters.search])
  // `customers` is the trigger here, not an input: the effect exists to clear
  // the selection whenever the list changes underneath it. Removing the
  // dependency — Biome's suggested fix — would leave ids selected that are no
  // longer on screen, and a bulk delete would then act on rows the operator
  // can no longer see.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger
  useEffect(() => setSelected(new Set()), [customers])

  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === filters.search) return
    const id = window.setTimeout(() => {
      router.replace(hrefFor({ ...filters, search: trimmed }), { scroll: false })
    }, 350)
    return () => window.clearTimeout(id)
  }, [search, filters, router])

  const hasActiveFilters =
    Boolean(filters.search) || filters.status !== 'all' || filters.range !== 'all'
  const exportQs = filterQuery(filters)
  const exportHref = `/portal/crm/export${exportQs ? `?${exportQs}` : ''}`
  const selectedRows = useMemo(
    () => customers.filter((customer) => selected.has(customer.id)),
    [customers, selected],
  )
  const allSelected = customers.length > 0 && selectedRows.length === customers.length
  const selectedExportRows = selectedRows.map((customer) => [
    customer.name ?? '',
    customer.phone,
    customer.email ?? '',
    CRM_STATUS_LABEL[customer.status] ?? customer.status,
    customer.tags.join(' | '),
    customer.notes ?? '',
    CRM_SOURCE_LABEL[customer.source] ?? customer.source,
    customer.calls,
    customer.lastCallAt ? fullDate(customer.lastCallAt) : '',
    fullDate(customer.createdAt),
  ])

  function toggleAll() {
    setSelected((previous) => {
      if (customers.length > 0 && customers.every((customer) => previous.has(customer.id))) {
        return new Set()
      }
      return new Set(customers.map((customer) => customer.id))
    })
  }

  function toggleOne(id: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <SummaryBar
        items={[
          { label: 'عميل', value: num(summary.total) },
          { label: 'عميل محتمل', value: num(summary.leads) },
          { label: 'نشط', value: num(summary.active), tone: 'good' },
          { label: 'من مكالمة', value: num(summary.fromCalls) },
        ]}
      />

      <div className="crm-toolbar">
        <input
          type="search"
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الجوال أو البريد…"
          aria-label="بحث في العملاء"
        />
        <select
          className="input"
          value={filters.status}
          onChange={(e) =>
            router.replace(hrefFor({ ...filters, status: e.target.value as CrmStatusFilter }), {
              scroll: false,
            })
          }
          aria-label="فلترة حسب الحالة"
        >
          <option value="all">كل الحالات</option>
          <option value="lead">عميل محتمل</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
        <select
          className="input"
          value={filters.range}
          onChange={(e) =>
            router.replace(hrefFor({ ...filters, range: e.target.value as CrmDateRange }), {
              scroll: false,
            })
          }
          aria-label="فلترة حسب التاريخ"
        >
          {Object.entries(CRM_RANGE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ColumnPicker visible={visible} onToggle={toggle} />
        <a className="btn btn--sm" href={exportHref}>
          <Download size={15} aria-hidden="true" />
          تصدير CSV
        </a>
        {canManage ? <AddCustomerButton workspaceId={workspaceId} /> : null}
      </div>

      {selectedRows.length > 0 ? (
        <div className="crm-bulk-bar">
          <strong>{num(selectedRows.length)} محدد</strong>
          <CsvExportButton
            filename={`mujawib-selected-customers-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={[
              'الاسم',
              'الجوال',
              'البريد الإلكتروني',
              'الحالة',
              'الوسوم',
              'ملاحظات',
              'المصدر',
              'عدد المكالمات',
              'آخر اتصال',
              'أُضيف في',
            ]}
            rows={selectedExportRows}
            label="تصدير المحدد"
          />
          {canManage ? (
            <Button
              size="sm"
              variant="danger"
              leading={<Trash2 size={15} />}
              disabled={pending}
              onClick={() => setBulkDeleteOpen(true)}
            >
              حذف المحدد
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setSelected(new Set())}>
            إلغاء التحديد
          </Button>
        </div>
      ) : null}

      <Section title="كل العملاء" meta={`${num(customers.length)} من ${num(summary.total)}`} flush>
        {customers.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'لا نتائج مطابقة' : 'لا عملاء بعد'}
            body={
              hasActiveFilters
                ? 'غيّر الفلاتر أو امسح البحث لعرض جهات اتصال أخرى.'
                : 'أضف أول جهة اتصال يدويًا، أو انتظر أول مكالمة تُنشئ عميلاً تلقائيًا.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="تحديد كل العملاء المعروضين"
                    />
                  </th>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>تواصل سريع</th>
                  {visible.has('email') ? <th>البريد الإلكتروني</th> : null}
                  {visible.has('status') ? <th>الحالة</th> : null}
                  {visible.has('tags') ? <th>الوسوم</th> : null}
                  {visible.has('calls') ? <th>المكالمات</th> : null}
                  {visible.has('source') ? <th>المصدر</th> : null}
                  {visible.has('lastCallAt') ? <th>آخر اتصال</th> : null}
                  {visible.has('notes') ? <th>ملاحظات</th> : null}
                  {visible.has('createdAt') ? <th>أُضيف في</th> : null}
                  {canManage ? <th aria-label="إجراءات" /> : null}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        aria-label={`تحديد ${c.name ?? c.phone}`}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.name ?? '—'}</td>
                    {/* The client owns this data and needs the real number to act on
                        it (call, export, hand to another system) — unlike the masked
                        call-log views elsewhere in the portal, this is not a passive
                        log but an editable, exportable contact database. */}
                    <td className="mono">{c.phone}</td>
                    <td>
                      <span className="row" style={{ gap: 'var(--s-1)' }}>
                        <a
                          href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--quiet btn--sm"
                          title="مراسلة عبر واتساب"
                          aria-label="واتساب"
                        >
                          <MessageSquare size={14} aria-hidden="true" />
                        </a>
                        <a
                          href={`tel:${c.phone}`}
                          className="btn btn--quiet btn--sm"
                          title="اتصال مباشر"
                          aria-label="اتصال"
                        >
                          <Phone size={14} aria-hidden="true" />
                        </a>
                      </span>
                    </td>
                    {visible.has('email') ? <td className="muted">{c.email ?? '—'}</td> : null}
                    {visible.has('status') ? (
                      <td>
                        <Pill tone={crmStatusTone(c.status)}>
                          {CRM_STATUS_LABEL[c.status] ?? c.status}
                        </Pill>
                      </td>
                    ) : null}
                    {visible.has('tags') ? (
                      <td>
                        {c.tags.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className="queue__flags">
                            {c.tags.map((t) => (
                              <Pill key={t} tone="signal">
                                {t}
                              </Pill>
                            ))}
                          </span>
                        )}
                      </td>
                    ) : null}
                    {visible.has('calls') ? <td className="mono">{num(c.calls)}</td> : null}
                    {visible.has('source') ? (
                      <td className="muted">{CRM_SOURCE_LABEL[c.source] ?? c.source}</td>
                    ) : null}
                    {visible.has('lastCallAt') ? (
                      <td className="muted">{relative(c.lastCallAt)}</td>
                    ) : null}
                    {visible.has('notes') ? (
                      <td className="muted" style={{ maxWidth: 240 }}>
                        {c.notes ?? '—'}
                      </td>
                    ) : null}
                    {visible.has('createdAt') ? (
                      <td className="muted">{fullDate(c.createdAt)}</td>
                    ) : null}
                    {canManage ? (
                      <td>
                        <CustomerRowActions workspaceId={workspaceId} customer={c} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Confirm
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() =>
          run(
            () => deleteCustomersBulk({ workspaceId, ids: selectedRows.map((row) => row.id) }),
            () => {
              setSelected(new Set())
              setBulkDeleteOpen(false)
            },
          )
        }
        title={`حذف ${selectedRows.length} جهة اتصال؟`}
        body="سيتم حذف جهات الاتصال المحددة من CRM فقط. سجل المكالمات المرتبط بها لا يتأثر."
        confirmLabel="احذف المحدد"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
