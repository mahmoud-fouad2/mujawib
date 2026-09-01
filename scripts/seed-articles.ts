/**
 * Seeds the launch article set.
 *
 *   pnpm content:seed
 *
 * Upserts by slug, and deliberately does **not** overwrite `body`, `title` or
 * `excerpt` on a row that already exists: once an article is in the database
 * the console owns it, and re-running a seed must never silently discard an
 * operator's edit. Only the derived fields are refreshed.
 *
 * Articles are seeded as drafts. Publishing is an editorial decision made in
 * the console, not a side effect of running a script.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readingMinutes } from '../lib/articles.ts'
import { ARTICLE_SEEDS } from '../lib/content/articles-seed.ts'
import { db } from '../server/db/index.ts'
import { article } from '../server/db/schema/index.ts'

const AUTHOR = 'فريق مُجاوِب'

let created = 0
let skipped = 0

for (const seed of ARTICLE_SEEDS) {
  const [existing] = await db
    .select({ id: article.id, status: article.status })
    .from(article)
    .where(eq(article.slug, seed.slug))
    .limit(1)

  if (existing) {
    skipped += 1
    console.log(`· exists, left untouched: ${seed.slug}`)
    continue
  }

  const now = new Date()
  await db.insert(article).values({
    id: `art_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    slug: seed.slug,
    locale: 'ar',
    title: seed.title,
    excerpt: seed.excerpt,
    body: seed.body,
    metaTitle: seed.metaTitle,
    metaDescription: seed.metaDescription,
    keywords: seed.keywords,
    category: seed.category,
    readMinutes: readingMinutes(seed.body),
    authorName: AUTHOR,
    status: 'draft',
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  })
  created += 1
  console.log(`+ created draft: ${seed.slug} (${readingMinutes(seed.body)} min)`)
}

console.log(`\n${created} created, ${skipped} already present.`)
console.log('Review and publish from /console/content.')
process.exit(0)
