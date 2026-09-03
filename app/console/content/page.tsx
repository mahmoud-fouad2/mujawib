import type { Metadata } from 'next'
import {
  AddAnnouncement,
  AddArticle,
  AnnouncementRowActions,
  AnnouncementToggle,
  ArticlePublishToggle,
  ArticleRowActions,
} from '@/components/console/content-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import {
  ANNOUNCEMENT_KIND_LABEL,
  ANNOUNCEMENT_SEVERITY_LABEL,
  isAnnouncementLive,
} from '@/lib/announcements'
import { ARTICLE_CATEGORY_LABEL, type ArticleCategory } from '@/lib/articles'
import { fullDate, num, relative } from '@/lib/format'
import { requireOperatorPermissionPage } from '@/server/auth/access'
import { getAnnouncementsForConsole, getArticlesForConsole } from '@/server/data/content'

export const metadata: Metadata = { title: 'المحتوى والإعلانات' }
export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  await requireOperatorPermissionPage('content.manage', '/console/content')

  const [announcements, articles] = await Promise.all([
    getAnnouncementsForConsole(),
    getArticlesForConsole(),
  ])

  const now = new Date()
  const liveCount = announcements.filter((a) =>
    isAnnouncementLive({ isActive: a.isActive, startsAt: a.startsAt, endsAt: a.endsAt }, now),
  ).length
  const published = articles.filter((a) => a.status === 'published').length

  return (
    <>
      <PageHead
        title="المحتوى والإعلانات"
        sub="شريط الإعلان الظاهر للزوار، ومقالات المدونة — كلاهما يُعدَّل من هنا بلا نشر جديد"
        actions={
          <>
            <AddAnnouncement />
            <AddArticle />
          </>
        }
      />

      <SummaryBar
        items={[
          {
            label: 'إعلان ظاهر الآن',
            value: num(liveCount),
            ...(liveCount > 0 ? { tone: 'warn' as const } : {}),
          },
          { label: 'مقالات منشورة', value: num(published) },
          { label: 'مسودات', value: num(articles.length - published) },
        ]}
      />

      <Section
        title="الإعلانات وإشعارات الصيانة"
        meta="يظهر أعلى كل صفحة. الإعلان الحرج لا يستطيع الزائر إخفاءه."
        flush
      >
        {announcements.length === 0 ? (
          <EmptyState
            title="لا توجد إعلانات"
            body="أنشئ إشعار صيانة مجدولًا مسبقًا ليظهر ويختفي وحده، أو إعلان عُطل تُفعّله بضغطة عند الحاجة."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>الشدة</th>
                  <th>النافذة الزمنية</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {announcements.map((row) => {
                  const live = isAnnouncementLive(
                    { isActive: row.isActive, startsAt: row.startsAt, endsAt: row.endsAt },
                    now,
                  )
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.titleAr}</strong>
                        {row.bodyAr ? <div className="muted">{row.bodyAr}</div> : null}
                      </td>
                      <td>{ANNOUNCEMENT_KIND_LABEL[row.kind] ?? row.kind}</td>
                      <td>
                        <Pill
                          {...(row.severity === 'critical'
                            ? { tone: 'bad' as const }
                            : row.severity === 'warning'
                              ? { tone: 'warn' as const }
                              : {})}
                        >
                          {ANNOUNCEMENT_SEVERITY_LABEL[row.severity] ?? row.severity}
                        </Pill>
                      </td>
                      <td className="muted">
                        {row.startsAt ? fullDate(row.startsAt) : 'فور التفعيل'}
                        {' → '}
                        {row.endsAt ? fullDate(row.endsAt) : 'حتى الإخفاء'}
                      </td>
                      <td>
                        <Pill {...(live ? { tone: 'good' as const } : {})} live={live}>
                          {live ? 'ظاهر للزوار' : row.isActive ? 'مفعّل خارج النافذة' : 'مخفي'}
                        </Pill>
                      </td>
                      <td className="row-actions-cell">
                        <AnnouncementToggle row={row} />
                        <AnnouncementRowActions row={row} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="مقالات المدونة"
        meta="المنشور يظهر في /blog وفي خريطة الموقع. المسودة لا تظهر لأحد."
        flush
      >
        {articles.length === 0 ? (
          <EmptyState
            title="لا توجد مقالات"
            body="شغّل pnpm content:seed لتحميل المجموعة الأولى كمسودات، ثم راجعها وانشرها."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>التصنيف</th>
                  <th>القراءة</th>
                  <th>آخر تعديل</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {articles.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                      <div className="muted mono">/blog/{row.slug}</div>
                    </td>
                    <td>
                      {ARTICLE_CATEGORY_LABEL[row.category as ArticleCategory] ?? row.category}
                    </td>
                    <td className="mono">{num(row.readMinutes)} د</td>
                    <td className="muted">{relative(row.updatedAt)}</td>
                    <td>
                      <Pill {...(row.status === 'published' ? { tone: 'good' as const } : {})}>
                        {row.status === 'published' ? 'منشور' : 'مسودة'}
                      </Pill>
                    </td>
                    <td className="row-actions-cell">
                      <ArticlePublishToggle row={row} />
                      <ArticleRowActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
