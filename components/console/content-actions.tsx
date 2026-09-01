'use client'

import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { RowAction, RowActionSeparator, RowActions, useAction } from '@/components/ui/row-actions'
import {
  ANNOUNCEMENT_AUDIENCE_LABEL,
  ANNOUNCEMENT_KIND_LABEL,
  ANNOUNCEMENT_SEVERITY_LABEL,
} from '@/lib/announcements'
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABEL } from '@/lib/articles'
import {
  deleteAnnouncement,
  deleteArticle,
  saveAnnouncement,
  saveArticle,
  setArticleStatus,
  toggleAnnouncement,
} from '@/server/actions/content'

/**
 * Operator controls for the public banner and the blog.
 *
 * The banner is the surface that matters during an incident, so the primary
 * control on each row is a single toggle — one click puts a maintenance
 * notice in front of every visitor, one takes it down. Editing sits behind
 * that, where the pressure is lower.
 */

export type AnnouncementRow = {
  id: string
  kind: string
  severity: string
  audience: string
  titleAr: string
  titleEn: string | null
  bodyAr: string | null
  bodyEn: string | null
  href: string | null
  isActive: boolean
  dismissible: boolean
  startsAt: Date | null
  endsAt: Date | null
}

export type ArticleRow = {
  id: string
  slug: string
  title: string
  status: string
}

/** `datetime-local` needs a local-time string, not an ISO instant. */
function toLocalInput(value: Date | null): string {
  if (!value) return ''
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

/* ─── announcements ──────────────────────────────────────────────────────── */

export function AnnouncementToggle({ row }: { row: AnnouncementRow }) {
  const { run, pending } = useAction()
  return (
    <Button
      size="sm"
      variant={row.isActive ? 'primary' : undefined}
      disabled={pending}
      aria-pressed={row.isActive}
      onClick={() => run(() => toggleAnnouncement(row.id, !row.isActive))}
    >
      {row.isActive ? 'ظاهر الآن' : 'مخفي'}
    </Button>
  )
}

type AnnouncementForm = {
  kind: 'maintenance' | 'incident' | 'notice' | 'promo'
  severity: 'info' | 'warning' | 'critical'
  audience: 'public' | 'app' | 'everyone'
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
  href: string
  startsAt: string
  endsAt: string
  isActive: boolean
  dismissible: boolean
}

function formFor(row?: AnnouncementRow): AnnouncementForm {
  if (!row) {
    return {
      kind: 'maintenance',
      severity: 'warning',
      audience: 'everyone',
      titleAr: '',
      titleEn: '',
      bodyAr: '',
      bodyEn: '',
      href: '',
      startsAt: '',
      endsAt: '',
      isActive: false,
      dismissible: true,
    }
  }
  return {
    kind: row.kind as AnnouncementForm['kind'],
    severity: row.severity as AnnouncementForm['severity'],
    audience: row.audience as AnnouncementForm['audience'],
    titleAr: row.titleAr,
    titleEn: row.titleEn ?? '',
    bodyAr: row.bodyAr ?? '',
    bodyEn: row.bodyEn ?? '',
    href: row.href ?? '',
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    isActive: row.isActive,
    dismissible: row.dismissible,
  }
}

function AnnouncementSheet({
  row,
  open,
  onClose,
}: {
  row?: AnnouncementRow
  open: boolean
  onClose: () => void
}) {
  const [form, setForm] = useState<AnnouncementForm>(() => formFor(row))
  const { run, pending } = useAction()

  const set = <K extends keyof AnnouncementForm>(key: K, value: AnnouncementForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={row ? 'تعديل الإعلان' : 'إعلان أو إشعار صيانة'}
      description="يظهر شريطًا أعلى الموقع. الإعلان الحرج لا يستطيع الزائر إخفاءه."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || form.titleAr.trim().length < 3}
            onClick={() =>
              run(
                () =>
                  saveAnnouncement({
                    ...(row ? { id: row.id } : {}),
                    kind: form.kind,
                    severity: form.severity,
                    audience: form.audience,
                    titleAr: form.titleAr,
                    titleEn: form.titleEn.trim() || undefined,
                    bodyAr: form.bodyAr.trim() || undefined,
                    bodyEn: form.bodyEn.trim() || undefined,
                    href: form.href.trim() || undefined,
                    startsAt: form.startsAt || undefined,
                    endsAt: form.endsAt || undefined,
                    isActive: form.isActive,
                    dismissible: form.dismissible,
                  }),
                onClose,
              )
            }
          >
            {pending ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="ann-kind">النوع</label>
        <select
          id="ann-kind"
          className="input"
          value={form.kind}
          onChange={(e) => set('kind', e.target.value as AnnouncementForm['kind'])}
        >
          {Object.entries(ANNOUNCEMENT_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ann-severity">الشدة</label>
        <select
          id="ann-severity"
          className="input"
          value={form.severity}
          onChange={(e) => set('severity', e.target.value as AnnouncementForm['severity'])}
        >
          {Object.entries(ANNOUNCEMENT_SEVERITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ann-audience">أين يظهر</label>
        <select
          id="ann-audience"
          className="input"
          value={form.audience}
          onChange={(e) => set('audience', e.target.value as AnnouncementForm['audience'])}
        >
          {Object.entries(ANNOUNCEMENT_AUDIENCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ann-title">العنوان</label>
        <input
          id="ann-title"
          className="input"
          value={form.titleAr}
          onChange={(e) => set('titleAr', e.target.value)}
          placeholder="صيانة مجدولة الجمعة ٢–٤ فجرًا"
        />
      </div>

      <div className="field">
        <label htmlFor="ann-body">النص</label>
        <textarea
          id="ann-body"
          className="input"
          rows={2}
          value={form.bodyAr}
          onChange={(e) => set('bodyAr', e.target.value)}
          placeholder="قد تتأثر المكالمات لدقائق. الخط البشري يعمل كالمعتاد."
        />
      </div>

      <div className="field">
        <label htmlFor="ann-title-en">العنوان بالإنجليزية (اختياري)</label>
        <input
          id="ann-title-en"
          className="input"
          value={form.titleEn}
          onChange={(e) => set('titleEn', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="ann-href">رابط داخلي (اختياري)</label>
        <input
          id="ann-href"
          className="input"
          value={form.href}
          onChange={(e) => set('href', e.target.value)}
          placeholder="/contact"
        />
        <span className="hint">الروابط الخارجية مرفوضة تلقائيًا.</span>
      </div>

      <div className="field">
        <label htmlFor="ann-starts">يبدأ (اختياري)</label>
        <input
          id="ann-starts"
          type="datetime-local"
          className="input"
          value={form.startsAt}
          onChange={(e) => set('startsAt', e.target.value)}
        />
        <span className="hint">اتركه فارغًا ليبدأ فور التفعيل.</span>
      </div>

      <div className="field">
        <label htmlFor="ann-ends">ينتهي (اختياري)</label>
        <input
          id="ann-ends"
          type="datetime-local"
          className="input"
          value={form.endsAt}
          onChange={(e) => set('endsAt', e.target.value)}
        />
        <span className="hint">يختفي تلقائيًا — بلا حاجة لأحد يتذكر إزالته.</span>
      </div>

      <div className="field field--inline">
        <input
          id="ann-active"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        <label htmlFor="ann-active">ظاهر الآن</label>
      </div>

      <div className="field field--inline">
        <input
          id="ann-dismissible"
          type="checkbox"
          checked={form.dismissible}
          onChange={(e) => set('dismissible', e.target.checked)}
        />
        <label htmlFor="ann-dismissible">يمكن للزائر إخفاؤه</label>
      </div>
    </Sheet>
  )
}

export function AddAnnouncement() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Megaphone size={15} />}
        onClick={() => setOpen(true)}
      >
        إعلان جديد
      </Button>
      {open ? <AnnouncementSheet open={open} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function AnnouncementRowActions({ row }: { row: AnnouncementRow }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction onClick={() => setEditing(true)}>تعديل</RowAction>
        <RowActionSeparator />
        <RowAction tone="danger" onClick={() => setConfirming(true)}>
          حذف
        </RowAction>
      </RowActions>

      {editing ? (
        <AnnouncementSheet row={row} open={editing} onClose={() => setEditing(false)} />
      ) : null}

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف الإعلان"
        body={`سيُحذف «${row.titleAr}» نهائيًا.`}
        pending={pending}
        confirmLabel={pending ? 'جارٍ الحذف…' : 'حذف'}
        onConfirm={() =>
          run(
            () => deleteAnnouncement(row.id),
            () => setConfirming(false),
          )
        }
      />
    </>
  )
}

/* ─── articles ───────────────────────────────────────────────────────────── */

export function ArticlePublishToggle({ row }: { row: ArticleRow }) {
  const { run, pending } = useAction()
  const published = row.status === 'published'
  return (
    <Button
      size="sm"
      variant={published ? 'primary' : undefined}
      disabled={pending}
      aria-pressed={published}
      onClick={() => run(() => setArticleStatus(row.id, published ? 'draft' : 'published'))}
    >
      {published ? 'منشور' : 'مسودة'}
    </Button>
  )
}

export function ArticleRowActions({ row }: { row: ArticleRow }) {
  const [confirming, setConfirming] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction href={`/blog/${encodeURIComponent(row.slug)}`}>معاينة</RowAction>
        <RowActionSeparator />
        <RowAction tone="danger" onClick={() => setConfirming(true)}>
          حذف
        </RowAction>
      </RowActions>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف المقال"
        body={`سيُحذف «${row.title}» ورابطه نهائيًا، وأي رابط خارجي إليه سيصبح صفحة غير موجودة.`}
        pending={pending}
        confirmLabel={pending ? 'جارٍ الحذف…' : 'حذف'}
        onConfirm={() =>
          run(
            () => deleteArticle(row.id),
            () => setConfirming(false),
          )
        }
      />
    </>
  )
}

export function AddArticle() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<(typeof ARTICLE_CATEGORIES)[number]>('guide')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const { run, pending } = useAction()

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        مقال جديد
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="مقال جديد"
        description="يُحفظ كمسودة. النشر خطوة منفصلة بعد المراجعة."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || title.trim().length < 6 || body.trim().length < 200}
              onClick={() =>
                run(
                  () =>
                    saveArticle({
                      title,
                      excerpt,
                      body,
                      category,
                      metaTitle: metaTitle.trim() || undefined,
                      metaDescription: metaDescription.trim() || undefined,
                      keywords: keywords
                        .split(',')
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .slice(0, 15),
                    }),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'حفظ كمسودة'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="art-title">العنوان</label>
          <input
            id="art-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className="hint">الرابط يُولَّد من العنوان مرة واحدة ولا يتغيّر بعدها.</span>
        </div>

        <div className="field">
          <label htmlFor="art-category">التصنيف</label>
          <select
            id="art-category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof ARTICLE_CATEGORIES)[number])}
          >
            {ARTICLE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {ARTICLE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="art-excerpt">المقتطف</label>
          <textarea
            id="art-excerpt"
            className="input"
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="art-body">النص</label>
          <textarea
            id="art-body"
            className="input"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'## عنوان فرعي\n\nفقرة.\n\n- نقطة\n- نقطة'}
          />
          <span className="hint">
            Markdown مبسّط: ‎## عنوان، ‎- قائمة، ‎**عريض**، ‎[نص](/رابط). لا يُسمح بـHTML.
          </span>
        </div>

        <div className="field">
          <label htmlFor="art-meta-title">عنوان محرك البحث (اختياري)</label>
          <input
            id="art-meta-title"
            className="input"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="art-meta-desc">وصف محرك البحث (اختياري)</label>
          <textarea
            id="art-meta-desc"
            className="input"
            rows={2}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="art-keywords">كلمات مفتاحية</label>
          <input
            id="art-keywords"
            className="input"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="رد آلي, حجز مواعيد, عيادات"
          />
          <span className="hint">مفصولة بفواصل.</span>
        </div>
      </Sheet>
    </>
  )
}

export function DeleteArticleIcon({ row }: { row: ArticleRow }) {
  const [confirming, setConfirming] = useState(false)
  const { run, pending } = useAction()
  return (
    <>
      <Button size="sm" onClick={() => setConfirming(true)} leading={<Trash2 size={14} />}>
        حذف
      </Button>
      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف المقال"
        body={`سيُحذف «${row.title}» نهائيًا.`}
        pending={pending}
        confirmLabel={pending ? 'جارٍ الحذف…' : 'حذف'}
        onConfirm={() =>
          run(
            () => deleteArticle(row.id),
            () => setConfirming(false),
          )
        }
      />
    </>
  )
}
