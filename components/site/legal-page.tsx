import type { Locale } from '@/lib/i18n'

export type LegalSection = { heading: string; body: string[] }

/**
 * Shared shell for policy pages: a single measured column, no cards, no
 * decoration. These pages exist to be read, not browsed.
 */
export function LegalPage({
  locale,
  eyebrow,
  title,
  lead,
  updated,
  sections,
}: {
  locale: Locale
  eyebrow: string
  title: string
  lead: string
  updated: string
  sections: LegalSection[]
}) {
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero__grid">
          <span className="section__label">{eyebrow}</span>
          <div>
            <h1>{title}</h1>
            <p className="page-hero__lead">{lead}</p>
            <p className="hero__proof-note">
              {locale === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
              {updated}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="prose">
            {sections.map((s) => (
              <div key={s.heading}>
                <h2>{s.heading}</h2>
                {s.body.map((p) => (
                  <p key={p} style={{ marginBlockStart: 'var(--s-3)' }}>
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
