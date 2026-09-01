import type { Metadata } from 'next'
import { BlogIndex } from '@/components/site/blog'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'
import { getPublishedArticles } from '@/server/data/content'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/blog',
  title: 'Blog — AI voice reception and customer service guides',
  description:
    'Practical guides on AI call answering, automatic appointment booking, and reducing missed calls for clinics, real estate, and services.',
})

export default async function EnglishBlogPage() {
  const articles = await getPublishedArticles()
  return (
    <SiteShell locale="en">
      <BlogIndex
        articles={articles}
        locale="en"
        title="Voice reception and customer service guides"
        intro="Practical articles on answering calls, booking appointments, and closing the gaps that cost you customers."
      />
    </SiteShell>
  )
}
