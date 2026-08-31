'use client'

import { Edit2, Plus, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { useAction } from '@/components/ui/row-actions'
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  updateKnowledgeItem,
} from '@/server/actions/console'

type KnowledgeItemRow = {
  id: string
  category: string
  title: string
  content: Record<string, unknown>
  createdAt: Date | string
}

const CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'service', label: 'الخدمات / المنتجات' },
  { id: 'branch', label: 'الفروع والمواقع' },
  { id: 'staff', label: 'الفريق والمختصون' },
  { id: 'policy', label: 'السياسات والشروط' },
  { id: 'faq', label: 'الأسئلة المتكررة' },
] as const

const EXTRA_FIELDS = {
  service: [
    ['suitableFor', 'لمن تناسب', 'الشريحة أو الحالة أو الهدف المناسب'],
    ['requirements', 'المتطلبات قبل التنفيذ', 'مستندات، مقاسات، موافقات، أو شروط مسبقة'],
    ['preparation', 'التحضير قبل الخدمة', 'تعليمات التحضير أو التجهيز المعتمدة'],
    ['aftercare', 'ما بعد الخدمة', 'خطوات المتابعة أو التسليم أو الدعم'],
    ['outcome', 'النتيجة المتوقعة', 'ما يحصل عليه العميل بعد التنفيذ'],
    ['availability', 'التوفر', 'الأيام، الفروع، أو الحالات التي تتوفر فيها'],
    ['owner', 'المسؤول أو المختص', 'اسم الفريق أو الشخص المسؤول'],
    ['branch', 'الفروع المتاحة', 'مثال: فرع الرياض'],
  ],
  staff: [
    ['specialty', 'التخصص الدقيق', 'مثال: مبيعات، دعم، طب تجميلي، صيانة'],
    ['role', 'المسمى المهني', 'استشاري، مدير حساب، فني، أخصائي أول…'],
    ['qualifications', 'المؤهلات والاعتمادات', 'البورد والزمالات المعتمدة'],
    ['experience', 'الخبرة', 'مثال: 12 سنة'],
    ['services', 'الخدمات أو المهام', 'افصل بين الخدمات بفاصلة'],
    ['languages', 'اللغات', 'العربية، الإنجليزية'],
    ['branch', 'الفرع أو الموقع', 'مكان عمل عضو الفريق'],
  ],
  branch: [
    ['address', 'العنوان الكامل', 'الحي، الشارع، العلامة المميزة'],
    ['hours', 'ساعات العمل', 'الأيام والساعات'],
    ['phone', 'رقم التواصل', 'مع رمز الدولة'],
  ],
  policy: [
    ['scope', 'نطاق السياسة', 'على أي خدمة أو عميل أو حالة تنطبق'],
    ['exceptions', 'الاستثناءات', 'متى لا تنطبق هذه السياسة'],
    ['escalation', 'متى يتم التصعيد', 'متى يحول الموظف الصوتي الطلب للفريق'],
  ],
  faq: [['relatedService', 'مرتبط بـ', 'الخدمة أو المنتج أو الفرع المرتبط بالسؤال']],
} as const

function ExtraKnowledgeFields({
  category,
  prefix,
  values,
  onChange,
}: {
  category: 'service' | 'branch' | 'staff' | 'policy' | 'faq'
  prefix: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const fields = category in EXTRA_FIELDS ? EXTRA_FIELDS[category as keyof typeof EXTRA_FIELDS] : []
  if (!fields.length) return null

  return (
    <div className="stack" style={{ gap: 'var(--s-3)' }}>
      {fields.map(([key, label, placeholder]) => (
        <div className="field" key={key}>
          <label htmlFor={`${prefix}-${key}`}>{label}</label>
          <input
            id={`${prefix}-${key}`}
            className="input"
            value={values[key] ?? ''}
            onChange={(event) => onChange(key, event.target.value)}
            placeholder={placeholder}
          />
        </div>
      ))}
    </div>
  )
}

export function KnowledgeManager({
  workspaceId,
  items,
}: {
  workspaceId: string
  items: KnowledgeItemRow[]
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItemRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form states
  const [category, setCategory] = useState<'service' | 'branch' | 'staff' | 'policy' | 'faq'>(
    'service',
  )
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [details, setDetails] = useState('')
  const [extra, setExtra] = useState<Record<string, string>>({})

  const { run, pending } = useAction()

  const openAdd = () => {
    setTitle('')
    setPrice('')
    setDuration('')
    setDetails('')
    setExtra({})
    setCategory('service')
    setAddOpen(true)
  }

  const openEdit = (item: KnowledgeItemRow) => {
    setEditingItem(item)
    setTitle(item.title)
    setCategory(item.category as typeof category)
    setPrice(typeof item.content.price === 'string' ? item.content.price : '')
    setDuration(typeof item.content.duration === 'string' ? item.content.duration : '')
    setDetails(
      typeof item.content.body === 'string'
        ? item.content.body
        : typeof item.content.description === 'string'
          ? item.content.description
          : '',
    )
    setExtra(
      Object.fromEntries(
        Object.entries(item.content).filter(
          ([key, value]) =>
            !['price', 'duration', 'body', 'description'].includes(key) &&
            typeof value === 'string',
        ),
      ) as Record<string, string>,
    )
  }

  const buildContent = (base: Record<string, unknown> = {}) => {
    const content = { ...base }
    for (const key of [
      'price',
      'duration',
      'body',
      'suitableFor',
      'preparation',
      'aftercare',
      'doctor',
      'owner',
      'branch',
      'requirements',
      'outcome',
      'availability',
      'specialty',
      'role',
      'qualifications',
      'experience',
      'services',
      'languages',
      'address',
      'hours',
      'phone',
      'scope',
      'exceptions',
      'escalation',
      'relatedService',
    ]) {
      delete content[key]
    }
    if (category === 'service' && price.trim()) content.price = price.trim()
    if (category === 'service' && duration.trim()) content.duration = duration.trim()
    if (details.trim()) content.body = details.trim()
    const allowedExtraKeys = new Set<string>(
      category in EXTRA_FIELDS
        ? EXTRA_FIELDS[category as keyof typeof EXTRA_FIELDS].map(([key]) => key)
        : [],
    )
    for (const [key, value] of Object.entries(extra)) {
      if (allowedExtraKeys.has(key) && value.trim()) content[key] = value.trim()
    }
    return content
  }

  const handleCreate = () => {
    const content = buildContent()

    run(
      () =>
        createKnowledgeItem({
          workspaceId,
          category,
          title,
          content,
        }),
      () => setAddOpen(false),
    )
  }

  const handleUpdate = () => {
    if (!editingItem) return
    const content = buildContent(editingItem.content)

    run(
      () =>
        updateKnowledgeItem({
          itemId: editingItem.id,
          category,
          title,
          content,
        }),
      () => setEditingItem(null),
    )
  }

  const handleDelete = (id: string) => {
    run(
      () => deleteKnowledgeItem(id),
      () => setDeletingId(null),
    )
  }

  const filtered =
    activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)

  return (
    <div className="knowledge-manager">
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBlockEnd: 'var(--s-3)',
        }}
      >
        <div className="workbench__filters" style={{ margin: 0, padding: 0 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={`filter-chip${activeCategory === c.id ? ' is-active' : ''}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="primary" onClick={openAdd}>
          <Plus size={14} />
          إضافة عنصر معرفة
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد عناصر في هذا القسم"
          body="أضف خدمات، منتجات، فروع، فريق، أو سياسات ليبني الموظف الصوتي ردوده منها حرفيًا."
        />
      ) : (
        <div className="queue">
          {filtered.map((item) => {
            const c = item.content
            return (
              <div key={item.id} className="queue__row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
                    <span className="queue__title">{item.title}</span>
                    <Pill>
                      <Tag size={10} style={{ marginInlineEnd: '4px' }} />
                      {CATEGORIES.find((cat) => cat.id === item.category)?.label ?? item.category}
                    </Pill>
                    {typeof c.price === 'string' && c.price ? (
                      <Pill tone="good">{c.price}</Pill>
                    ) : null}
                    {typeof c.duration === 'string' && c.duration ? (
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        ({c.duration})
                      </span>
                    ) : null}
                  </div>
                  {typeof c.body === 'string' && c.body ? (
                    <p
                      style={{
                        fontSize: 'var(--step--1)',
                        color: 'var(--text-muted)',
                        marginBlockStart: '4px',
                      }}
                    >
                      {c.body}
                    </p>
                  ) : null}
                </div>

                <div className="row" style={{ gap: 'var(--s-2)' }}>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="btn btn--quiet btn--sm"
                    title="تعديل"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(item.id)}
                    className="btn btn--quiet btn--sm"
                    style={{ color: 'var(--bad)' }}
                    title="حذف"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Sheet */}
      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="إضافة عنصر معرفة جديد"
        description="الموظف الصوتي يجيب من هذه المعرفة حرفيًا ويمنع اختلاق أي أسعار أو سياسات أو تفاصيل غير مسجلة هنا."
        footer={
          <>
            <Button onClick={() => setAddOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button variant="primary" disabled={pending || !title.trim()} onClick={handleCreate}>
              {pending ? 'جارٍ الحفظ…' : 'حفظ العنصر'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <div className="field">
            <label htmlFor="item-category">نوع المعرفة</label>
            <select
              id="item-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              <option value="service">خدمة / منتج / عرض</option>
              <option value="branch">فرع أو موقع</option>
              <option value="staff">عضو فريق / مختص</option>
              <option value="policy">سياسة أو شرط</option>
              <option value="faq">سؤال متكرر وإجابته</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="item-title">
              {category === 'service'
                ? 'اسم الخدمة أو المنتج'
                : category === 'branch'
                  ? 'اسم الفرع أو المنطقة'
                  : category === 'staff'
                    ? 'اسم عضو الفريق / المختص'
                    : category === 'faq'
                      ? 'السؤال'
                      : 'عنوان السياسة'}
            </label>
            <input
              id="item-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اكتب العنوان بوضوح…"
            />
          </div>

          {category === 'service' ? (
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="item-price">السعر (شاملاً الضريبة إن وُجد)</label>
                <input
                  id="item-price"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="مثال: 250 ريال"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="item-duration">المدة التقديرية</label>
                <input
                  id="item-duration"
                  className="input"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="مثال: 30 دقيقة"
                />
              </div>
            </div>
          ) : null}

          <ExtraKnowledgeFields
            category={category}
            prefix="item"
            values={extra}
            onChange={(key, value) => setExtra((current) => ({ ...current, [key]: value }))}
          />

          <div className="field">
            <label htmlFor="item-details">
              {category === 'faq' ? 'الإجابة المعتمدة' : 'شرح معتمد وتفاصيل مهمة'}
            </label>
            <textarea
              id="item-details"
              className="input"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="اكتب التفاصيل التي ينبغي للموظف الصوتي قولها عند السؤال، بدون وعود غير مؤكدة…"
            />
          </div>
        </div>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="تعديل عنصر المعرفة"
        description="تحديث المعرفة يصبح متاحًا للموظف الصوتي في المكالمة التالية."
        footer={
          <>
            <Button onClick={() => setEditingItem(null)} disabled={pending}>
              إلغاء
            </Button>
            <Button variant="primary" disabled={pending || !title.trim()} onClick={handleUpdate}>
              {pending ? 'جارٍ الحفظ…' : 'تحديث'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <div className="field">
            <label htmlFor="edit-category">نوع المعرفة</label>
            <select
              id="edit-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              <option value="service">خدمة / منتج / عرض</option>
              <option value="branch">فرع أو موقع</option>
              <option value="staff">عضو فريق / مختص</option>
              <option value="policy">سياسة أو شرط</option>
              <option value="faq">سؤال متكرر وإجابته</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="edit-title">العنوان</label>
            <input
              id="edit-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {category === 'service' ? (
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="edit-price">السعر</label>
                <input
                  id="edit-price"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="edit-duration">المدة</label>
                <input
                  id="edit-duration"
                  className="input"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <ExtraKnowledgeFields
            category={category}
            prefix="edit"
            values={extra}
            onChange={(key, value) => setExtra((current) => ({ ...current, [key]: value }))}
          />

          <div className="field">
            <label htmlFor="edit-details">التفاصيل / الإجابة</label>
            <textarea
              id="edit-details"
              className="input"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>
      </Sheet>

      {/* Delete Confirmation */}
      <Confirm
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="حذف عنصر المعرفة"
        body="هل أنت متأكد من حذف هذا العنصر؟ لن يتمكن الموظف الصوتي من استخدام هذه المعلومة بعد الحذف."
        confirmLabel="نعم، احذف العنصر"
        tone="danger"
        pending={pending}
        onConfirm={() => deletingId && handleDelete(deletingId)}
      />
    </div>
  )
}
