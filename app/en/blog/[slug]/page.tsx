import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/blog'
import { SiteShell } from '@/components/site/site-shell'
import { articleBreadcrumbSchema, articleSchema, JsonLd, pageMetadata } from '@/lib/seo'
import { getArticleBySlug } from '@/server/data/content'

type Params = { params: Promise<{ slug: string }> }

/**
 * Metadata comes from the row's own SEO fields when they exist, falling back
 * to the display title and excerpt. Keeping them separate matters: the
 * headline that reads best on the page is rarely the one that reads best in a
 * result list, and conflating them always compromises one of the two.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(decodeURIComponent(slug))
  if (!article) return { title: 'Not found' }

  return pageMetadata({
    locale: 'en',
    path: `/blog/${article.slug}`,
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt,
  })
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params
  const article = await getArticleBySlug(decodeURIComponent(slug))
  if (!article) notFound()

  return (
    <SiteShell locale="en">
      {article.publishedAt ? (
        <JsonLd
          data={[
            articleSchema({
              slug: article.slug,
              title: article.metaTitle ?? article.title,
              description: article.metaDescription ?? article.excerpt,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              authorName: article.authorName,
              keywords: article.keywords,
              locale: 'en',
            }),
            articleBreadcrumbSchema({ slug: article.slug, title: article.title, locale: 'en' }),
          ]}
        />
      ) : null}
      <ArticleView article={article} locale="en" />
    </SiteShell>
  )
}
