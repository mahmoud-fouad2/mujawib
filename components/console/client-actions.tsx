'use client'

import {
  Archive,
  ArchiveRestore,
  Building2,
  ExternalLink,
  LayoutGrid,
  Pencil,
  Phone,
  Plug,
  Radio,
  ScrollText,
  Search,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { Pill } from '@/components/ui/primitives'
import { RowAction, RowActionSeparator, RowActions, useAction } from '@/components/ui/row-actions'
import {
  archiveClient,
  type ClientDeletionImpact,
  deleteClientPermanently,
  getClientDeletionImpact,
  restoreClient,
  setClientCrmEnabled,
  updateClient,
  updateClientRecordingPolicy,
} from '@/server/actions/console'

const STATUSES = [
  { value: 'discovery', label: 'اكتشاف — نجمع المتطلبات' },
  { value: 'setup', label: 'إعداد — نبني الموظف الصوتي' },
  { value: 'pilot', label: 'تجريبي — يعمل على نطاق محدود' },
  { value: 'live', label: 'تشغيل — يستقبل كل المكالمات' },
  { value: 'paused', label: 'موقوف — المكالمات تذهب للفريق' },
] as const

import type { ClientEditable } from '@/lib/client-editable'

function clientsHrefFor(search: string, status: string) {
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  const qs = params.toString()
  return `/console/clients${qs ? `?${qs}` : ''}`
}

export function ClientsToolbar({ search, status }: { search: string; status: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(search)

  useEffect(() => setQuery(search), [search])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === search) return
    const id = window.setTimeout(() => {
      router.replace(clientsHrefFor(trimmed, status), { scroll: false })
    }, 350)
    return () => window.clearTimeout(id)
  }, [query, search, status, router])

  return (
    <div className="clients-toolbar">
      <div className="clients-toolbar__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث باسم العميل…"
          aria-label="بحث في العملاء"
        />
      </div>
      <select
        className="input"
        value={status}
        onChange={(event) => router.replace(clientsHrefFor(query, event.target.value))}
        aria-label="فلترة حسب الحالة"
      >
        <option value="">كل الحالات</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A labelled input. Declared once so every field in the sheet matches. */
function Field({
  id,
  label,
  value,
  onChange,
  hint,
  placeholder,
  mono,
  type = 'text',
  rows,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  hint?: string
  placeholder?: string
  mono?: boolean
  type?: string
  rows?: number
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {rows ? (
        <textarea
          id={id}
          className="input"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className={mono ? 'input mono' : 'input'}
          dir={mono ? 'ltr' : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

export function ClientRowActions({
  client,
  canDelete,
}: {
  client: ClientEditable
  /** Only the platform owner sees permanent deletion at all. */
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [impact, setImpact] = useState<ClientDeletionImpact | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [form, setForm] = useState(client)
  const { run, pending } = useAction()

  const archived = client.status === 'archived'
  const set = (key: keyof ClientEditable) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  function openDelete() {
    setConfirmation('')
    setImpact(null)
    setDeleting(true)
    // Counted live rather than cached: the operator is about to act on it.
    run(async () => {
      const result = await getClientDeletionImpact(client.workspaceId)
      if (result.ok) setImpact(result.data)
      return result.ok ? { ok: true, message: '' } : result
    })
  }

  return (
    <>
      <RowActions>
        <RowAction icon={<ExternalLink size={15} />} href={`/console/clients/${client.slug}`}>
          افتح ملف العميل
        </RowAction>
        <RowAction
          icon={<Pencil size={15} />}
          onClick={() => setEditing(true)}
          disabled={archived}
          title={archived ? 'العميل مؤرشف — استعده أولًا' : undefined}
        >
          عدّل البيانات
        </RowAction>

        <RowActionSeparator />

        <RowAction icon={<Phone size={15} />} href={`/console/phone?client=${client.slug}`}>
          أرقامه والتوجيه
        </RowAction>
        <RowAction icon={<LayoutGrid size={15} />} href={`/console/agents?client=${client.slug}`}>
          موظفوه الصوتيون
        </RowAction>
        <RowAction icon={<Plug size={15} />} href={`/console/integrations?client=${client.slug}`}>
          الربط والتكاملات
        </RowAction>
        <RowAction icon={<Radio size={15} />} href={`/console/calls?client=${client.slug}`}>
          مكالماته
        </RowAction>
        <RowAction icon={<Building2 size={15} />} href={`/portal/switch?client=${client.slug}`}>
          افتح بوابته
        </RowAction>

        <RowActionSeparator />

        {archived ? (
          <RowAction
            icon={<ArchiveRestore size={15} />}
            onClick={() => run(() => restoreClient(client.workspaceId))}
          >
            استعد العميل
          </RowAction>
        ) : (
          <RowAction icon={<Archive size={15} />} onClick={() => setArchiving(true)}>
            أرشف العميل
          </RowAction>
        )}

        <RowAction
          icon={<Trash2 size={15} />}
          tone="danger"
          onClick={canDelete ? openDelete : undefined}
          disabled={!canDelete}
          title={canDelete ? undefined : 'الحذف النهائي متاح لمالك المنصة فقط'}
        >
          احذف نهائيًا
        </RowAction>
      </RowActions>

      {/* ── edit ────────────────────────────────────────────────────────── */}
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title={`تعديل ${client.name}`}
        description="الحالة تتحكم في استقبال المكالمات. الباقي يستخدمه الموظف الصوتي أثناء المكالمة، أو يظهر للعميل في بوابته."
        footer={
          <>
            <Button onClick={() => setEditing(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || form.name.trim().length < 2}
              onClick={() =>
                run(
                  () =>
                    updateClient({
                      workspaceId: client.workspaceId,
                      name: form.name,
                      status: form.status as (typeof STATUSES)[number]['value'],
                      legalName: form.legalName,
                      industry: form.industry,
                      city: form.city,
                      country: form.country,
                      website: form.website,
                      supportEmail: form.supportEmail,
                      publicPhone: form.publicPhone,
                      hoursWeekday: form.hoursWeekday,
                      transferTo: form.transferTo,
                      notes: form.notes,
                      monthlyCallLimit: form.monthlyCallLimit,
                      concurrentCallLimit: form.concurrentCallLimit,
                    }),
                  () => setEditing(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'احفظ'}
            </Button>
          </>
        }
      >
        <div className="sheet__group">
          <h3>الهوية</h3>
          <Field
            id={`name-${client.workspaceId}`}
            label="اسم الشركة كما يُنطق"
            value={form.name}
            onChange={set('name')}
            hint="هذا ما ينطقه الموظف الصوتي عند الرد."
          />
          <Field
            id={`legal-${client.workspaceId}`}
            label="الاسم التجاري / النظامي"
            value={form.legalName}
            onChange={set('legalName')}
            placeholder="شركة … للتجارة"
          />
          <Field
            id={`industry-${client.workspaceId}`}
            label="القطاع"
            value={form.industry}
            onChange={set('industry')}
            placeholder="عيادات، عقارات، خدمات سيارات…"
          />
        </div>

        <div className="sheet__group">
          <h3>التشغيل</h3>
          <div className="field">
            <label htmlFor={`status-${client.workspaceId}`}>الحالة</label>
            <select
              id={`status-${client.workspaceId}`}
              className="input"
              value={form.status}
              onChange={(event) => set('status')(event.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {form.status === 'paused' ? (
              <span className="field__error">
                الإيقاف يحوّل كل المكالمات الواردة إلى رقم فريقك مباشرة.
              </span>
            ) : null}
          </div>
          <Field
            id={`hours-${client.workspaceId}`}
            label="ساعات العمل (الأحد – الخميس)"
            value={form.hoursWeekday}
            onChange={set('hoursWeekday')}
            placeholder="09:00–21:00"
            mono
          />
          <Field
            id={`transfer-${client.workspaceId}`}
            label="رقم التحويل عند التصعيد"
            value={form.transferTo}
            onChange={set('transferTo')}
            placeholder="+966551200430"
            hint="إلى هنا تذهب المكالمة عندما يطلب المتصل موظفًا بشريًا."
            mono
          />
        </div>

        <div className="sheet__group">
          <h3>حدود الاستخدام</h3>
          <p className="field__hint" style={{ marginBlockEnd: 'var(--s-2)' }}>
            تُطبّق فعليًا عند قبول المكالمة: إذا تجاوز العميل الحد الشهري أو المتزامن تُرفض المكالمة
            بأمان وتُسجّل في السجل التشغيلي.
          </p>
          <div className="field">
            <label htmlFor={`monthly-limit-${client.workspaceId}`}>الحد الشهري للمكالمات</label>
            <input
              id={`monthly-limit-${client.workspaceId}`}
              className="input mono"
              type="number"
              min={1}
              value={form.monthlyCallLimit ?? ''}
              placeholder="بلا حد"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  monthlyCallLimit: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
            <span className="field__hint">اتركه فارغًا لعميل بلا حد شهري.</span>
          </div>
          <div className="field">
            <label htmlFor={`concurrent-limit-${client.workspaceId}`}>
              الحد الأقصى للمكالمات المتزامنة
            </label>
            <input
              id={`concurrent-limit-${client.workspaceId}`}
              className="input mono"
              type="number"
              min={1}
              value={form.concurrentCallLimit}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  concurrentCallLimit: Math.max(1, Number(event.target.value) || 1),
                }))
              }
            />
          </div>
        </div>

        <div className="sheet__group">
          <h3>بيانات التواصل</h3>
          <Field
            id={`city-${client.workspaceId}`}
            label="المدينة"
            value={form.city}
            onChange={set('city')}
          />
          <Field
            id={`country-${client.workspaceId}`}
            label="الدولة"
            value={form.country}
            onChange={set('country')}
            placeholder="السعودية"
          />
          <Field
            id={`website-${client.workspaceId}`}
            label="الموقع الإلكتروني"
            value={form.website}
            onChange={set('website')}
            placeholder="https://example.com"
            mono
          />
          <Field
            id={`email-${client.workspaceId}`}
            label="بريد الدعم"
            value={form.supportEmail}
            onChange={set('supportEmail')}
            placeholder="support@example.com"
            type="email"
            mono
          />
          <Field
            id={`public-${client.workspaceId}`}
            label="الرقم المعلن للعملاء"
            value={form.publicPhone}
            onChange={set('publicPhone')}
            placeholder="+966126700245"
            mono
          />
        </div>

        <div className="sheet__group">
          <h3>ملاحظات الفريق</h3>
          <Field
            id={`notes-${client.workspaceId}`}
            label="ملاحظات داخلية"
            value={form.notes}
            onChange={set('notes')}
            rows={4}
            hint="لا تظهر للعميل ولا يستخدمها الموظف الصوتي."
          />
        </div>
      </Sheet>

      {/* ── archive ─────────────────────────────────────────────────────── */}
      <Confirm
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={() =>
          run(
            () => archiveClient(client.workspaceId),
            () => setArchiving(false),
          )
        }
        title={`أرشفة ${client.name}؟`}
        body="يخرج العميل من كل شاشات التشغيل وتُعطَّل أرقامه فلا تصل إليه مكالمات. المكالمات والنسخ وسجل التدقيق تبقى كما هي، ويمكن استعادته في أي وقت."
        confirmLabel="أرشف"
        pending={pending}
      />

      {/* ── permanent delete ────────────────────────────────────────────── */}
      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`حذف ${client.name} نهائيًا`}
        description="هذا الإجراء لا يمكن التراجع عنه."
        footer={
          <>
            <Button onClick={() => setDeleting(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              disabled={pending || confirmation !== client.name}
              onClick={() =>
                run(
                  () =>
                    deleteClientPermanently({
                      workspaceId: client.workspaceId,
                      confirmation,
                    }),
                  () => setDeleting(false),
                )
              }
            >
              {pending ? 'جارٍ الحذف…' : 'احذف نهائيًا'}
            </Button>
          </>
        }
      >
        <p className="sheet__lead">
          سيُحذف العميل وكل ما يرتبط به. إن كان الهدف إيقافه فقط، فالأرشفة تفعل ذلك دون فقدان أي سجل.
        </p>

        {impact ? (
          <ul className="impact-list">
            <li>
              <span>المكالمات المسجّلة</span>
              <strong>{impact.calls.toLocaleString('ar-SA')}</strong>
            </li>
            <li>
              <span>الموظفون الصوتيون</span>
              <strong>{impact.agents}</strong>
            </li>
            <li>
              <span>نسخ الموظفين</span>
              <strong>{impact.versions}</strong>
            </li>
            <li>
              <span>الأرقام ومساراتها</span>
              <strong>
                {impact.phoneNumbers}
                {impact.activeRoutes > 0 ? ` (${impact.activeRoutes} مفعّل)` : ''}
              </strong>
            </li>
            <li>
              <span>الاتصالات والتكاملات</span>
              <strong>{impact.integrations}</strong>
            </li>
            <li>
              <span>المستخدمون المرتبطون</span>
              <strong>{impact.users}</strong>
            </li>
            <li>
              <span>طلبات التعديل</span>
              <strong>{impact.requests}</strong>
            </li>
          </ul>
        ) : (
          <p className="muted">جارٍ حساب السجلات المرتبطة…</p>
        )}

        {impact && impact.liveCalls > 0 ? (
          <p className="field__error">
            لدى العميل {impact.liveCalls} مكالمة جارية الآن. لن يسمح النظام بالحذف قبل انتهائها.
          </p>
        ) : null}

        <Field
          id={`confirm-${client.workspaceId}`}
          label={`اكتب «${client.name}» للتأكيد`}
          value={confirmation}
          onChange={setConfirmation}
          hint="التطابق الحرفي مطلوب. لن يُحذف شيء قبله."
        />
      </Sheet>
    </>
  )
}

/* ─── CRM feature flag ───────────────────────────────────────────────────── */

/** A packaging switch, not a settings form — one flag, flipped and done. */
export function CrmFeatureToggle({
  workspaceId,
  enabled,
}: {
  workspaceId: string
  enabled: boolean
}) {
  const { run, pending } = useAction()

  return (
    <div className="cluster">
      <Pill tone={enabled ? 'good' : 'neutral'}>{enabled ? 'CRM مفعّلة' : 'CRM غير مفعّلة'}</Pill>
      <Button
        size="sm"
        variant={enabled ? 'danger' : 'primary'}
        disabled={pending}
        onClick={() => run(() => setClientCrmEnabled({ workspaceId, enabled: !enabled }))}
      >
        {enabled ? 'عطّل CRM' : 'فعّل CRM لهذا العميل'}
      </Button>
    </div>
  )
}

export function RecordingPolicyControl({
  workspaceId,
  enabled,
  disclosureMode,
  jurisdiction,
  approvedAt,
}: {
  workspaceId: string
  enabled: boolean
  disclosureMode: string
  jurisdiction: string | null
  approvedAt: string | null
}) {
  const [open, setOpen] = useState(false)
  const [nextEnabled, setNextEnabled] = useState(enabled)
  const [nextDisclosure, setNextDisclosure] = useState(disclosureMode)
  const [nextJurisdiction, setNextJurisdiction] = useState(jurisdiction ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ScrollText size={15} aria-hidden="true" />
        {enabled ? 'التسجيل معتمد' : 'سياسة التسجيل'}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="سياسة تسجيل المكالمات"
        description="قرار تشغيلي لكل عميل، مستقل عن إعداد التخزين العام للمنصة."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || (nextEnabled && !confirmed)}
              onClick={() =>
                run(
                  () =>
                    updateClientRecordingPolicy({
                      workspaceId,
                      enabled: nextEnabled,
                      disclosureMode:
                        nextDisclosure === 'agent_intro' || nextDisclosure === 'external'
                          ? nextDisclosure
                          : 'none',
                      jurisdiction: nextJurisdiction,
                      authorizationConfirmed: confirmed,
                    }),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'احفظ السياسة'}
            </Button>
          </>
        }
      >
        <p className="sheet__lead">
          لا يبدأ التسجيل إلا بعد تفعيل التخزين الخاص واعتماد هذه السياسة. الإعداد مغلق افتراضيًا ولا
          يُعد بديلًا عن المراجعة النظامية المحلية.
        </p>
        <div className="recording-policy-status">
          <Pill tone={enabled ? 'good' : 'neutral'}>{enabled ? 'مفعّل' : 'متوقف'}</Pill>
          <span>
            {approvedAt
              ? `آخر اعتماد: ${new Date(approvedAt).toLocaleDateString('ar-SA')}`
              : 'لم يُعتمد بعد'}
          </span>
        </div>
        <label className="recording-policy-toggle">
          <input
            type="checkbox"
            checked={nextEnabled}
            onChange={(event) => {
              setNextEnabled(event.target.checked)
              setConfirmed(false)
            }}
          />
          <span>
            <strong>السماح بتسجيل مكالمات هذا العميل</strong>
            <small>يظل التسجيل متوقفًا إذا لم يكن التخزين الخاص مهيأ على المنصة.</small>
          </span>
        </label>
        {nextEnabled ? (
          <div className="sheet__group">
            <h3>الإفصاح والاعتماد</h3>
            <div className="field">
              <label htmlFor={`recording-disclosure-${workspaceId}`}>طريقة إبلاغ المتصل</label>
              <select
                id={`recording-disclosure-${workspaceId}`}
                className="input"
                value={nextDisclosure}
                onChange={(event) => {
                  setNextDisclosure(event.target.value)
                  setConfirmed(false)
                }}
              >
                <option value="none">اختر طريقة الإفصاح</option>
                <option value="agent_intro">الموظف الصوتي يبلّغ المتصل في بداية المكالمة</option>
                <option value="external">إفصاح خارجي موثّق قبل وصول المكالمة</option>
              </select>
            </div>
            <Field
              id={`recording-jurisdiction-${workspaceId}`}
              label="الدولة أو النطاق القضائي المراجع"
              value={nextJurisdiction}
              onChange={(value) => {
                setNextJurisdiction(value)
                setConfirmed(false)
              }}
              placeholder="المملكة العربية السعودية"
            />
            <label className="recording-policy-toggle recording-policy-toggle--confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                <strong>أؤكد وجود تفويض من العميل ومراجعة متطلبات الإفصاح المحلية</strong>
                <small>يُسجل اسم المشغّل ووقت الاعتماد في سجل التدقيق.</small>
              </span>
            </label>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
