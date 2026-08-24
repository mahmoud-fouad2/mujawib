'use client'

import { BookOpen, Edit2, Plus, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
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
  { id: 'service', label: 'الخدمات والأسعار' },
  { id: 'branch', label: 'الفروع' },
  { id: 'staff', label: 'فريق العمل / الأطباء' },
  { id: 'policy', label: 'السياسات والشروط' },
  { id: 'faq', label: 'الأسئلة المتكررة' },
] as const

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

  const { run, pending } = useAction()

  const openAdd = () => {
    setTitle('')
    setPrice('')
    setDuration('')
    setDetails('')
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
  }

  const handleCreate = () => {
    const content: Record<string, unknown> = {}
    if (price) content.price = price
    if (duration) content.duration = duration
    if (details) content.body = details

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
    const content: Record<string, unknown> = { ...editingItem.content }
    if (price) content.price = price
    if (duration) content.duration = duration
    if (details) content.body = details

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
        <div className="empty" style={{ marginBlock: 'var(--s-4)' }}>
          <BookOpen size={20} className="muted" />
          <h3>لا توجد عناصر في هذا القسم</h3>
          <p>أضف خدمات، فروع، أو سياسات ليبني الموظف الصوتي ردوده منها حرفيًا.</p>
        </div>
      ) : (
        <div className="queue">
          {filtered.map((item) => {
            const c = item.content
            return (
              <div key={item.id} className="queue__row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
                    <span className="queue__title">{item.title}</span>
                    <span className="pill" style={{ fontSize: '0.7rem' }}>
                      <Tag size={10} style={{ marginInlineEnd: '4px' }} />
                      {CATEGORIES.find((cat) => cat.id === item.category)?.label ?? item.category}
                    </span>
                    {typeof c.price === 'string' && c.price ? (
                      <span className="pill pill--good" style={{ fontSize: '0.7rem' }}>
                        {c.price}
                      </span>
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
        description="الموظف الصوتي يجيب من هذه المعرفة حرفيًا ويمنع هلوسة أي أسعار أو سياسات غير مسجلة هنا."
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
              <option value="service">خدمة وسعر</option>
              <option value="branch">فرع أو موقع</option>
              <option value="staff">طبيب / موظف مختص</option>
              <option value="policy">سياسة أو شرط</option>
              <option value="faq">سؤال متكرر وإجابته</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="item-title">
              {category === 'service'
                ? 'اسم الخدمة'
                : category === 'branch'
                  ? 'اسم الفرع أو المنطقة'
                  : category === 'staff'
                    ? 'اسم الطبيب / الموظف والتخصص'
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

          <div className="field">
            <label htmlFor="item-details">
              {category === 'faq' ? 'الإجابة المعتمدة' : 'تفاصيل إضافية أو شروط الخدمة'}
            </label>
            <textarea
              id="item-details"
              className="input"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="اكتب التفاصيل التي ينبغي للموظف الصوتي قولها عند السؤال…"
            />
          </div>
        </div>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="تعديل عنصر المعرفة"
        description="تحديث البيانات يطبق تلقائيًا على المسودة التالية للموظف الصوتي."
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
              <option value="service">خدمة وسعر</option>
              <option value="branch">فرع أو موقع</option>
              <option value="staff">طبيب / موظف مختص</option>
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
