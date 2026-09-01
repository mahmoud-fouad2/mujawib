import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/**
 * Operator-editable public content: the banner that tells everyone the
 * service is degraded, and the articles that bring people to the site.
 *
 * Both live in the database rather than in files for the same reason: an
 * operator has to be able to change them at 2am without a deploy. A
 * maintenance notice that needs a build to appear is not a maintenance
 * notice, and an article that needs a pull request to fix a typo will keep
 * the typo.
 */

/** What the banner is for. Drives its colour and whether it can be dismissed. */
export type AnnouncementKind = 'maintenance' | 'incident' | 'notice' | 'promo'
export type AnnouncementSeverity = 'info' | 'warning' | 'critical'
/** Where it shows: the public site, the signed-in surfaces, or both. */
export type AnnouncementAudience = 'public' | 'app' | 'everyone'

export const announcement = pgTable(
  'announcement',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<AnnouncementKind>().notNull().default('notice'),
    severity: text('severity').$type<AnnouncementSeverity>().notNull().default('info'),
    audience: text('audience').$type<AnnouncementAudience>().notNull().default('everyone'),

    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en'),
    bodyAr: text('body_ar'),
    bodyEn: text('body_en'),
    /** Optional "read more" target. Internal paths only — validated on write. */
    href: text('href'),

    /**
     * Scheduling. A planned maintenance window is written once, ahead of
     * time, and appears and disappears on its own — the alternative is
     * somebody remembering to log in at 3am to take a banner down.
     * Null `startsAt` means "from now"; null `endsAt` means "until switched
     * off". `isActive` is the manual override that beats both.
     */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(false),
    /** A critical incident should not be dismissible; a promo should be. */
    dismissible: boolean('dismissible').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedById: text('updated_by_id').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [index('announcement_active_idx').on(t.isActive, t.startsAt, t.endsAt)],
)

export type ArticleStatus = 'draft' | 'published'
export type ArticleLocale = 'ar' | 'en'

export const article = pgTable(
  'article',
  {
    id: text('id').primaryKey(),
    /**
     * The URL. Unique across locales because the Arabic and English sites
     * live under different path prefixes, not different slugs — one article
     * is one slug, and `/blog/x` and `/en/blog/x` are the same piece.
     */
    slug: text('slug').notNull().unique(),
    locale: text('locale').$type<ArticleLocale>().notNull().default('ar'),

    title: text('title').notNull(),
    excerpt: text('excerpt').notNull(),
    /** Markdown, rendered by the restricted renderer in lib/articles.ts. */
    body: text('body').notNull(),

    /**
     * Search metadata kept separate from the display title. The headline that
     * reads best on the page is rarely the one that reads best in a result
     * list, and conflating them means always compromising one.
     */
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    keywords: jsonb('keywords').$type<string[]>().notNull().default([]),

    category: text('category').notNull().default('general'),
    /** Minutes, computed on write from the body — see lib/articles.ts. */
    readMinutes: integer('read_minutes').notNull().default(1),
    authorName: text('author_name'),

    status: text('status').$type<ArticleStatus>().notNull().default('draft'),
    /** Set the first time it is published; the public list orders by it. */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedById: text('updated_by_id').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('article_published_idx').on(t.status, t.locale, t.publishedAt),
    index('article_category_idx').on(t.category, t.publishedAt),
  ],
)
