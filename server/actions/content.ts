'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { safeAnnouncementHref } from '@/lib/announcements'
import { ARTICLE_CATEGORIES, readingMinutes, slugify } from '@/lib/articles'
import { authorizeOperator } from '@/server/auth/access'
import { ANNOUNCEMENT_CACHE_TAG, ARTICLE_CACHE_TAG } from '@/server/data/content'
import { db } from '@/server/db'
import { announcement, article, auditLog } from '@/server/db/schema'

/**
 * Operator control over public content.
 *
 * Every write here changes what an anonymous visitor sees, so all of it sits
 * behind `content.manage` and all of it is audited. The cache tags are dropped
 * on write rather than waiting out the revalidate window: an operator turning
 * on a maintenance banner has to see it immediately, and finding out that a
 * notice takes five minutes to appear is not something to discover during an
 * actual incident.
 */

export type ContentActionResult = { ok: true; message: string } | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

async function requireContentAccess() {
  return authorizeOperator('content.manage')
}

async function audit(input: {
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  note: string
}) {
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: null,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: { note: input.note },
    createdAt: new Date(),
  })
}

/**
 * Public surfaces that render operator content, revalidated together.
 *
 * The banner is in the site shell, so it is on every marketing page — listing
 * them individually would mean forgetting one.
 */
function revalidatePublicSurfaces() {
  revalidateTag(ANNOUNCEMENT_CACHE_TAG)
  revalidatePath('/', 'layout')
  revalidatePath('/en', 'layout')
}

/* ─── announcements ──────────────────────────────────────────────────────── */

const announcementSchema = z.object({
  id: z.string().trim().min(1).optional(),
  kind: z.enum(['maintenance', 'incident', 'notice', 'promo']),
  severity: z.enum(['info', 'warning', 'critical']),
  audience: z.enum(['public', 'app', 'everyone']),
  titleAr: z.string().trim().min(3, 'اكتب عنوانًا واضحًا.').max(160),
  titleEn: z.string().trim().max(160).optional(),
  bodyAr: z.string().trim().max(600).optional(),
  bodyEn: z.string().trim().max(600).optional(),
  href: z.string().trim().max(200).optional(),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  isActive: z.boolean(),
  dismissible: z.boolean(),
})

function parseWhen(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export async function saveAnnouncement(
  input: z.input<typeof announcementSchema>,
): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const parsed = announcementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات الإعلان غير مكتملة.' }
  }

  const startsAt = parseWhen(parsed.data.startsAt)
  const endsAt = parseWhen(parsed.data.endsAt)
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: 'وقت الانتهاء يجب أن يكون بعد وقت البدء.' }
  }

  const now = new Date()
  const values = {
    kind: parsed.data.kind,
    severity: parsed.data.severity,
    audience: parsed.data.audience,
    titleAr: parsed.data.titleAr,
    titleEn: parsed.data.titleEn || null,
    bodyAr: parsed.data.bodyAr || null,
    bodyEn: parsed.data.bodyEn || null,
    // Internal paths only — an announcement must not be able to point off-site.
    href: safeAnnouncementHref(parsed.data.href),
    startsAt,
    endsAt,
    isActive: parsed.data.isActive,
    dismissible: parsed.data.dismissible,
    updatedAt: now,
    updatedById: access.userId,
  }

  const announcementId = parsed.data.id ?? id('ann')
  if (parsed.data.id) {
    await db.update(announcement).set(values).where(eq(announcement.id, parsed.data.id))
  } else {
    await db.insert(announcement).values({ ...values, id: announcementId, createdAt: now })
  }

  await audit({
    actorId: access.userId,
    action: parsed.data.id ? 'content.announcement_updated' : 'content.announcement_created',
    resourceType: 'announcement',
    resourceId: announcementId,
    note: `${parsed.data.kind} — ${parsed.data.titleAr}${parsed.data.isActive ? ' (مفعّل)' : ''}`,
  })

  revalidatePublicSurfaces()
  revalidatePath('/console/content')
  return {
    ok: true,
    message: parsed.data.isActive ? 'حُفظ الإعلان وهو ظاهر الآن.' : 'حُفظ الإعلان كمسودة غير ظاهرة.',
  }
}

/** The switch an operator reaches for during an incident. One click, no form. */
export async function toggleAnnouncement(
  announcementId: string,
  isActive: boolean,
): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const [row] = await db
    .update(announcement)
    .set({ isActive, updatedAt: new Date(), updatedById: access.userId })
    .where(eq(announcement.id, announcementId))
    .returning({ id: announcement.id, titleAr: announcement.titleAr })
  if (!row) return { ok: false, error: 'الإعلان غير موجود.' }

  await audit({
    actorId: access.userId,
    action: isActive ? 'content.announcement_enabled' : 'content.announcement_disabled',
    resourceType: 'announcement',
    resourceId: row.id,
    note: row.titleAr,
  })

  revalidatePublicSurfaces()
  revalidatePath('/console/content')
  return { ok: true, message: isActive ? 'الإعلان ظاهر الآن.' : 'أُخفي الإعلان.' }
}

export async function deleteAnnouncement(announcementId: string): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const [row] = await db
    .delete(announcement)
    .where(eq(announcement.id, announcementId))
    .returning({ titleAr: announcement.titleAr })
  if (!row) return { ok: false, error: 'الإعلان غير موجود.' }

  await audit({
    actorId: access.userId,
    action: 'content.announcement_deleted',
    resourceType: 'announcement',
    resourceId: announcementId,
    note: row.titleAr,
  })

  revalidatePublicSurfaces()
  revalidatePath('/console/content')
  return { ok: true, message: 'حُذف الإعلان.' }
}

/* ─── articles ───────────────────────────────────────────────────────────── */

const articleSchema = z.object({
  id: z.string().trim().min(1).optional(),
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(6, 'العنوان قصير جدًا.').max(180),
  excerpt: z.string().trim().min(20, 'اكتب مقتطفًا يشرح المقال.').max(400),
  body: z.string().trim().min(200, 'المقال قصير جدًا لينشر.').max(60_000),
  metaTitle: z.string().trim().max(180).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  keywords: z.array(z.string().trim().min(2).max(60)).max(15),
  category: z.enum(ARTICLE_CATEGORIES),
})

export async function saveArticle(
  input: z.input<typeof articleSchema>,
): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const parsed = articleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات المقال غير مكتملة.' }
  }

  // The slug is derived from the title on creation and then frozen: changing
  // a published article's URL breaks every existing link to it and discards
  // whatever ranking it had earned.
  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title)
  if (!slug) return { ok: false, error: 'تعذّر توليد رابط من العنوان.' }

  const now = new Date()
  const values = {
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    body: parsed.data.body,
    metaTitle: parsed.data.metaTitle || null,
    metaDescription: parsed.data.metaDescription || null,
    keywords: parsed.data.keywords,
    category: parsed.data.category,
    readMinutes: readingMinutes(parsed.data.body),
    updatedAt: now,
    updatedById: access.userId,
  }

  const articleId = parsed.data.id ?? id('art')
  if (parsed.data.id) {
    await db.update(article).set(values).where(eq(article.id, parsed.data.id))
  } else {
    const [existing] = await db
      .select({ id: article.id })
      .from(article)
      .where(eq(article.slug, slug))
      .limit(1)
    if (existing) return { ok: false, error: 'يوجد مقال بنفس الرابط. غيّر العنوان.' }

    await db.insert(article).values({
      ...values,
      id: articleId,
      slug,
      locale: 'ar',
      authorName: 'فريق مُجاوِب',
      status: 'draft',
      createdAt: now,
    })
  }

  await audit({
    actorId: access.userId,
    action: parsed.data.id ? 'content.article_updated' : 'content.article_created',
    resourceType: 'article',
    resourceId: articleId,
    note: parsed.data.title,
  })

  revalidateTag(ARTICLE_CACHE_TAG)
  revalidatePath('/console/content')
  return { ok: true, message: 'حُفظ المقال.' }
}

export async function setArticleStatus(
  articleId: string,
  status: 'draft' | 'published',
): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const [current] = await db
    .select({ id: article.id, title: article.title, publishedAt: article.publishedAt })
    .from(article)
    .where(eq(article.id, articleId))
    .limit(1)
  if (!current) return { ok: false, error: 'المقال غير موجود.' }

  await db
    .update(article)
    .set({
      status,
      // Set once, on first publish. Re-publishing after an edit must not move
      // the original date — that is the signal search engines read as "this
      // is new", and resetting it on every correction is a lie about age.
      publishedAt:
        status === 'published' ? (current.publishedAt ?? new Date()) : current.publishedAt,
      updatedAt: new Date(),
      updatedById: access.userId,
    })
    .where(eq(article.id, articleId))

  await audit({
    actorId: access.userId,
    action: status === 'published' ? 'content.article_published' : 'content.article_unpublished',
    resourceType: 'article',
    resourceId: articleId,
    note: current.title,
  })

  revalidateTag(ARTICLE_CACHE_TAG)
  revalidatePath('/console/content')
  revalidatePath('/blog')
  return {
    ok: true,
    message: status === 'published' ? 'نُشر المقال.' : 'أُخفي المقال من المدونة.',
  }
}

export async function deleteArticle(articleId: string): Promise<ContentActionResult> {
  const access = await requireContentAccess()
  if (!access) return { ok: false, error: 'لا تملك صلاحية إدارة المحتوى.' }

  const [row] = await db
    .delete(article)
    .where(eq(article.id, articleId))
    .returning({ title: article.title })
  if (!row) return { ok: false, error: 'المقال غير موجود.' }

  await audit({
    actorId: access.userId,
    action: 'content.article_deleted',
    resourceType: 'article',
    resourceId: articleId,
    note: row.title,
  })

  revalidateTag(ARTICLE_CACHE_TAG)
  revalidatePath('/console/content')
  revalidatePath('/blog')
  return { ok: true, message: 'حُذف المقال.' }
}
