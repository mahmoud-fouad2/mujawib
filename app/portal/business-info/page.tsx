import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import {
  AddServiceButton,
  EditHoursButton,
  ServiceRowActions,
} from '@/components/portal/portal-actions'
import { EmptyState } from '@/components/ui/primitives'
import { num } from '@/lib/format'
import { getPortalBusinessInfo, getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'بيانات النشاط' }
export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  service: 'الخدمات',
  branch: 'الفروع',
  staff: 'الفريق',
  policy: 'السياسات',
  faq: 'أسئلة شائعة',
  document: 'مستندات',
}

export default async function PortalBusinessInfoPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const { items } = await getPortalBusinessInfo(workspace.id)
  const info = (workspace.businessInfo ?? {}) as {
    city?: string
    hours?: Record<string, string>
    transferTo?: string
  }

  const services = items.filter((i) => i.category === 'service')
  const others = items.filter((i) => i.category !== 'service')

  const byCategory = new Map<string, typeof others>()
  for (const item of others) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
  }

  return (
    <>
      <PageHead
        title="بيانات النشاط"
        sub="ما يعرفه المُجاوِب عن عملك — وهو ما يجيب به على المتصلين"
      />

      <div className="split">
        <Section
          title="ساعات العمل"
          meta="يعمل بها المُجاوِب فورًا"
          action={
            <EditHoursButton
              workspaceId={workspace.id}
              hoursWeekday={info.hours?.sun_thu ?? '09:00–21:00'}
              hoursWeekend={info.hours?.sat ?? ''}
            />
          }
          flush
        >
          <div className="queue">
            <div className="queue__row">
              <div className="queue__title">الأحد – الخميس</div>
              <span className="mono muted">{info.hours?.sun_thu ?? '—'}</span>
            </div>
            <div className="queue__row">
              <div className="queue__title">السبت</div>
              <span className="mono muted">{info.hours?.sat ?? 'مغلق'}</span>
            </div>
            <div className="queue__row">
              <div className="queue__title">الجمعة</div>
              <span className="mono muted">{info.hours?.fri ?? 'مغلق'}</span>
            </div>
            <div className="queue__row">
              <div className="queue__title">المدينة</div>
              <span className="muted">{info.city ?? '—'}</span>
            </div>
            <div className="queue__row">
              <div className="queue__title">رقم التحويل</div>
              <span className="mono muted">{info.transferTo ?? '—'}</span>
            </div>
          </div>
        </Section>

        <Section title="الاحتفاظ بالبيانات" meta="حسب سياستك" flush>
          <div className="queue">
            {Object.entries((workspace.retentionPolicy ?? {}) as Record<string, string>).map(
              ([key, value]) => (
                <div key={key} className="queue__row">
                  <div className="queue__title">
                    {key === 'calls'
                      ? 'سجلات المكالمات'
                      : key === 'recordings'
                        ? 'التسجيلات'
                        : 'النصوص'}
                  </div>
                  <span className="mono muted">{value}</span>
                </div>
              ),
            )}
          </div>
        </Section>
      </div>

      <div style={{ height: 'var(--s-4)' }} />

      <Section
        title="الخدمات وأسعارها"
        meta={`${num(services.length)} خدمة`}
        action={<AddServiceButton workspaceId={workspace.id} />}
        flush
      >
        {services.length === 0 ? (
          <EmptyState
            title="لم تُضف خدمات بعد"
            body="أضف خدماتك وأسعارها ليجيب عنها المُجاوِب مباشرة بدل تحويل المتصل."
          />
        ) : (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>الخدمة</th>
                  <th>السعر</th>
                  <th>المدة</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {services.map((item) => {
                  const content = (item.content ?? {}) as Record<string, string>
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.title}</td>
                      <td className="muted">{content.price ?? '—'}</td>
                      <td className="muted">{content.duration ?? '—'}</td>
                      <td>
                        <ServiceRowActions id={item.id} title={item.title} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {[...byCategory.entries()].map(([category, list]) => (
        <div key={category} style={{ marginBlockStart: 'var(--s-4)' }}>
          <Section
            title={CATEGORY_LABEL[category] ?? category}
            meta={`${num(list.length)} مدخل`}
            flush
          >
            <div className="queue">
              {list.map((item) => {
                const content = (item.content ?? {}) as Record<string, string>
                return (
                  <div key={item.id} className="queue__row">
                    <div className="queue__title">{item.title}</div>
                    <span className="muted" style={{ fontSize: '0.8125rem' }}>
                      {Object.values(content).filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>
      ))}
    </>
  )
}
