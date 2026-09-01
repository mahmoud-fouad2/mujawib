import Link from 'next/link'
import { ArticleCover } from '@/components/site/article-cover'
import {
  ARTICLE_CATEGORY_LABEL,
  type ArticleCategory,
  articleOutline,
  renderArticleBody,
} from '@/lib/articles'
import { type Locale, localePath } from '@/lib/i18n'
import type { ArticleCard, FullArticle } from '@/server/data/content'

/**
 * The blog surfaces, shared by both locales.
 *
 * Both are server components: an article is text, and text does not need a
 * client bundle to be read. The only interactive element on either page is a
 * link.
 */

function categoryLabel(category: string): string {
  return ARTICLE_CATEGORY_LABEL[category as ArticleCategory] ?? category
}

function formatDate(value: Date | null, locale: Locale): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(value)
}

export function BlogIndex({
  articles,
  locale,
  title,
  intro,
}: {
  articles: ArticleCard[]
  locale: Locale
  title: string
  intro: string
}) {
  const [lead, ...rest] = articles

  return (
    <div className="blog">
      <header className="blog__head">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>

      {articles.length === 0 ? (
        <p className="blog__empty">
          {locale === 'ar' ? 'لا توجد مقالات منشورة بعد.' : 'No articles published yet.'}
        </p>
      ) : null}

      {lead ? (
        <Link className="blog-lead" href={localePath(locale, `/blog/${lead.slug}`)}>
          <ArticleCover slug={lead.slug} height={260} />
          <div className="blog-lead__body">
            <span className="blog__tag">{categoryLabel(lead.category)}</span>
            <h2>{lead.title}</h2>
            <p>{lead.excerpt}</p>
            <span className="blog__meta">
              {formatDate(lead.publishedAt, locale)} ·{' '}
              {locale === 'ar' ? `${lead.readMinutes} دقائق قراءة` : `${lead.readMinutes} min read`}
            </span>
          </div>
        </Link>
      ) : null}

      {rest.length > 0 ? (
        <div className="blog-grid">
          {rest.map((item) => (
            <Link
              key={item.slug}
              className="blog-card"
              href={localePath(locale, `/blog/${item.slug}`)}
            >
              <ArticleCover slug={item.slug} />
              <div className="blog-card__body">
                <span className="blog__tag">{categoryLabel(item.category)}</span>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <span className="blog__meta">
                  {locale === 'ar'
                    ? `${item.readMinutes} دقائق قراءة`
                    : `${item.readMinutes} min read`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ArticleView({ article, locale }: { article: FullArticle; locale: Locale }) {
  const outline = articleOutline(article.body)
  const html = renderArticleBody(article.body)

  return (
    <article className="article">
      <header className="article__head">
        <Link className="article__back" href={localePath(locale, '/blog')}>
          {locale === 'ar' ? '→ كل المقالات' : '← All articles'}
        </Link>
        <span className="blog__tag">{categoryLabel(article.category)}</span>
        <h1>{article.title}</h1>
        <p className="article__excerpt">{article.excerpt}</p>
        <span className="blog__meta">
          {formatDate(article.publishedAt, locale)} ·{' '}
          {locale === 'ar'
            ? `${article.readMinutes} دقائق قراءة`
            : `${article.readMinutes} min read`}
          {article.authorName ? ` · ${article.authorName}` : ''}
        </span>
      </header>

      <ArticleCover slug={article.slug} height={220} />

      {outline.length > 2 ? (
        <nav className="article__toc" aria-label={locale === 'ar' ? 'محتويات' : 'Contents'}>
          <span className="article__toc-title">
            {locale === 'ar' ? 'في هذا المقال' : 'In this article'}
          </span>
          <ol>
            {outline.map((heading) => (
              <li key={heading}>{heading}</li>
            ))}
          </ol>
        </nav>
      ) : null}

      {/* Rendered by the restricted Markdown renderer in lib/articles.ts, which
          escapes before it formats — the article body is operator input on a
          public page, so nothing here may pass raw HTML through. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: output is escaped-then-formatted by renderArticleBody */}
      <div className="article__body" dangerouslySetInnerHTML={{ __html: html }} />

      <aside className="article__cta">
        <h2>{locale === 'ar' ? 'جرّب مُجاوِب على رقمك' : 'Try MUJAWIB on your number'}</h2>
        <p>
          {locale === 'ar'
            ? 'موظف استقبال صوتي يرد بالعربية، يحجز في تقويمك، ويحوّل لفريقك عند الحاجة.'
            : 'An Arabic voice receptionist that answers, books into your calendar, and hands over to your team.'}
        </p>
        <Link className="btn btn--primary" href={localePath(locale, '/contact')}>
          {locale === 'ar' ? 'اطلب عرضًا' : 'Request a demo'}
        </Link>
      </aside>
    </article>
  )
}
