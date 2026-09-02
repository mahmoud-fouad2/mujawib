import 'server-only'

import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { readingMinutes } from '@/lib/articles'
import { ARTICLE_SEEDS } from '@/lib/content/articles-seed'
import { db } from '@/server/db'
import { article } from '@/server/db/schema'
import { voiceError, voiceLog } from '@/server/voice/log'

/**
 * Puts the launch articles in the database at boot, once.
 *
 * This deployment has no shell, so `pnpm content:seed` can never be run
 * against it — a seeding step that needs a human at a terminal is a step that
 * never happens. Migrations can carry data, but ten long Arabic markdown
 * bodies inside hand-written SQL is a quoting minefield for no benefit, so
 * this runs from the same boot hook that starts the worker.
 *
 * Three properties make it safe to run on every boot:
 *
 *  - It only inserts slugs that are absent. An operator's edits are never
 *    overwritten, and a re-deploy does not resurrect an article they deleted
 *    on purpose... which is why deletion is a real decision: see below.
 *  - Articles arrive as drafts. Publishing stays an editorial act.
 *  - It never throws into the boot path. A content seed failing must not stop
 *    a container that answers phone calls from starting.
 *
 * On the deleted-article case: a slug removed in the console *will* come back
 * as a draft on the next deploy. That is the deliberate trade — the
 * alternative is a tombstone table for a set of ten seed articles, which is
 * more machinery than the problem deserves. A draft is invisible to the
 * public, so the cost of the wrong choice here is one row an operator deletes
 * again, not a page anyone sees.
 */
export async function ensureSeedArticles(): Promise<void> {
  try {
    const slugs = ARTICLE_SEEDS.map((seed) => seed.slug)
    const existing = await db
      .select({ slug: article.slug })
      .from(article)
      .where(inArray(article.slug, slugs))

    const present = new Set(existing.map((row) => row.slug))
    const missing = ARTICLE_SEEDS.filter((seed) => !present.has(seed.slug))
    if (missing.length === 0) return

    const now = new Date()
    await db.insert(article).values(
      missing.map((seed) => ({
        id: `art_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
        slug: seed.slug,
        locale: 'ar' as const,
        title: seed.title,
        excerpt: seed.excerpt,
        body: seed.body,
        metaTitle: seed.metaTitle,
        metaDescription: seed.metaDescription,
        keywords: seed.keywords,
        category: seed.category,
        readMinutes: readingMinutes(seed.body),
        authorName: 'فريق مُجاوِب',
        status: 'draft' as const,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
    )

    voiceLog('CONTENT_SEEDED', { articles: missing.length })
  } catch (error) {
    // Never fatal. The site works without the blog; the container must start.
    voiceError('CONTENT_SEED_FAILED', String(error).slice(0, 200))
  }
}
