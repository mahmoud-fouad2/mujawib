import 'server-only'

import { and, desc, eq, isNotNull, ne } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import {
  announcementMatchesAudience,
  compareAnnouncements,
  isAnnouncementLive,
  safeAnnouncementHref,
} from '@/lib/announcements'
import { db } from '@/server/db'
import {
  type AnnouncementAudience,
  type AnnouncementKind,
  type AnnouncementSeverity,
  type ArticleStatus,
  announcement,
  article,
} from '@/server/db/schema'

/**
 * Public reads for operator-authored content.
 *
 * Cached across requests from the start. The marketing pages were previously
 * running about fifteen uncached queries per visit on the pool the console
 * shares, and adding a blog and a site-wide banner to that would have made a
 * known problem worse rather than repeating it once and fixing it later.
 */

export const ANNOUNCEMENT_CACHE_TAG = 'announcements'
export const ARTICLE_CACHE_TAG = 'articles'

/**
 * Short window on purpose. This is the banner that says the service is down,
 * so an operator switching it on must see it appear in under a minute —
 * long enough to absorb a crawl, short enough to be useful in an incident.
 */
const ANNOUNCEMENT_TTL_SECONDS = 30
const ARTICLE_TTL_SECONDS = 300

export type LiveAnnouncement = {
  id: string
  kind: AnnouncementKind
  severity: AnnouncementSeverity
  audience: AnnouncementAudience
  titleAr: string
  titleEn: string | null
  bodyAr: string | null
  bodyEn: string | null
  href: string | null
  dismissible: boolean
  startsAt: Date | null
  endsAt: Date | null
}

const loadCandidateAnnouncements = unstable_cache(
  async (): Promise<LiveAnnouncement[]> => {
    const rows = await db
      .select({
        id: announcement.id,
        kind: announcement.kind,
        severity: announcement.severity,
        audience: announcement.audience,
        titleAr: announcement.titleAr,
        titleEn: announcement.titleEn,
        bodyAr: announcement.bodyAr,
        bodyEn: announcement.bodyEn,
        href: announcement.href,
        dismissible: announcement.dismissible,
        startsAt: announcement.startsAt,
        endsAt: announcement.endsAt,
      })
      .from(announcement)
      .where(eq(announcement.isActive, true))
      .limit(20)
    return rows.map((row) => ({ ...row, href: safeAnnouncementHref(row.href) }))
  },
  ['announcements', 'active'],
  { revalidate: ANNOUNCEMENT_TTL_SECONDS, tags: [ANNOUNCEMENT_CACHE_TAG] },
)

/**
 * The single banner to show, or null.
 *
 * The time window is evaluated *after* the cache, not inside the query: a
 * scheduled notice must start on time even if the cached row set is a few
 * seconds old, and filtering by `now` in SQL would make every distinct second
 * its own cache key.
 */
export async function getLiveAnnouncement(
  surface: 'public' | 'app',
  now: Date = new Date(),
): Promise<LiveAnnouncement | null> {
  const candidates = await loadCandidateAnnouncements()
  const live = candidates
    // `isActive` is already true for every row the query returned, so the
    // window check only has the schedule left to evaluate.
    .filter((item) =>
      isAnnouncementLive({ isActive: true, startsAt: item.startsAt, endsAt: item.endsAt }, now),
    )
    .filter((item) => announcementMatchesAudience(item.audience, surface))
    .sort(compareAnnouncements)
  return live[0] ?? null
}

export type ArticleCard = {
  slug: string
  title: string
  excerpt: string
  category: string
  readMinutes: number
  publishedAt: Date | null
}

export const getPublishedArticles = unstable_cache(
  async (): Promise<ArticleCard[]> => {
    return db
      .select({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
        readMinutes: article.readMinutes,
        publishedAt: article.publishedAt,
      })
      .from(article)
      .where(and(eq(article.status, 'published'), isNotNull(article.publishedAt)))
      .orderBy(desc(article.publishedAt))
      .limit(60)
  },
  ['articles', 'published'],
  { revalidate: ARTICLE_TTL_SECONDS, tags: [ARTICLE_CACHE_TAG] },
)

export type FullArticle = ArticleCard & {
  body: string
  metaTitle: string | null
  metaDescription: string | null
  keywords: string[]
  authorName: string | null
  updatedAt: Date
}

/**
 * One article by slug, published only.
 *
 * The slug is part of the cache key rather than a filter applied afterwards,
 * so a popular article is served from one entry instead of re-reading the
 * whole table per request.
 */
export const getArticleBySlug = unstable_cache(
  async (slug: string): Promise<FullArticle | null> => {
    const [row] = await db
      .select({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,
        category: article.category,
        readMinutes: article.readMinutes,
        publishedAt: article.publishedAt,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        keywords: article.keywords,
        authorName: article.authorName,
        updatedAt: article.updatedAt,
      })
      .from(article)
      .where(and(eq(article.slug, slug), eq(article.status, 'published')))
      .limit(1)
    return row ?? null
  },
  ['articles', 'by-slug'],
  { revalidate: ARTICLE_TTL_SECONDS, tags: [ARTICLE_CACHE_TAG] },
)

/** Slugs for the sitemap. Published only — a draft must never be advertised. */
export const getPublishedArticleSlugs = unstable_cache(
  async (): Promise<{ slug: string; updatedAt: Date }[]> => {
    return db
      .select({ slug: article.slug, updatedAt: article.updatedAt })
      .from(article)
      .where(and(eq(article.status, 'published'), isNotNull(article.publishedAt)))
      .limit(500)
  },
  ['articles', 'slugs'],
  { revalidate: ARTICLE_TTL_SECONDS, tags: [ARTICLE_CACHE_TAG] },
)

/* ─── operator reads (uncached — the editor must see its own writes) ─────── */

export async function getAnnouncementsForConsole() {
  return db.select().from(announcement).orderBy(desc(announcement.updatedAt)).limit(50)
}

export async function getArticlesForConsole(status?: ArticleStatus) {
  const base = db
    .select({
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category,
      status: article.status,
      readMinutes: article.readMinutes,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    })
    .from(article)
  const rows = status
    ? await base.where(eq(article.status, status)).orderBy(desc(article.updatedAt)).limit(200)
    : await base.orderBy(desc(article.updatedAt)).limit(200)
  return rows
}

export async function getArticleForEditor(id: string) {
  const [row] = await db.select().from(article).where(eq(article.id, id)).limit(1)
  return row ?? null
}

/** Counts for the console nav badge. */
export async function getContentCounts() {
  const [drafts] = await db
    .select({ n: article.id })
    .from(article)
    .where(ne(article.status, 'published'))
    .limit(1)
  return { hasDrafts: Boolean(drafts) }
}
