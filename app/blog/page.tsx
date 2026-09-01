import type { Metadata } from 'next'
import { BlogIndex } from '@/components/site/blog'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'
import { getPublishedArticles } from '@/server/data/content'

export const metadata: Metadata = pageMetadata({
  locale: 'ar',
  path: '/blog',
  title: 'المدونة — أدلة الرد الصوتي وخدمة العملاء بالذكاء الاصطناعي | مُجاوِب',
  description:
    'أدلة عملية عن الرد على المكالمات بالذكاء الاصطناعي، حجز المواعيد تلقائيًا، وتقليل المكالمات الضائعة في العيادات والعقار والخدمات.',
})

export default async function BlogPage() {
  const articles = await getPublishedArticles()
  return (
    <SiteShell locale="ar">
      <BlogIndex
        articles={articles}
        locale="ar"
        title="أدلة الرد الصوتي وخدمة العملاء"
        intro="مقالات عملية عن استقبال المكالمات، حجز المواعيد، وتقليل الفرص الضائعة — مكتوبة من واقع تشغيل حقيقي."
      />
    </SiteShell>
  )
}
