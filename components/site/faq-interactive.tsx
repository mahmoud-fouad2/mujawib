'use client'

import { ArrowLeft, ArrowRight, Minus, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { LinkButton } from '@/components/ui/button'
import { type Locale, localePath } from '@/lib/i18n'

export function FaqInteractive({
  groups,
  labels,
}: {
  groups: { title: string; items: { q: string; a: string }[] }[]
  labels: {
    searchPlaceholder: string
    searchSuggestions: string[]
    contactCtaTitle: string
    contactCtaBody: string
    contactCtaButton: string
    locale: Locale
  }
}) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Filter groups
  const filteredGroups = groups
    .map((g) => {
      if (activeCategory && activeCategory !== g.title) return null

      const filteredItems = g.items.filter(
        (item) =>
          item.q.toLowerCase().includes(query.toLowerCase()) ||
          item.a.toLowerCase().includes(query.toLowerCase()),
      )

      if (filteredItems.length === 0) return null

      return { ...g, items: filteredItems }
    })
    .filter(Boolean)

  const isAr = labels.locale === 'ar'
  const Arrow = isAr ? ArrowLeft : ArrowRight

  return (
    <div className="faq-interactive">
      <div className="faq-controls container reveal">
        <div className="faq-search-wrapper">
          <div className="faq-search">
            <Search className="faq-search__icon" size={18} />
            <input
              type="text"
              placeholder={labels.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="faq-search__input"
            />
          </div>
          <div className="faq-suggestions">
            {labels.searchSuggestions.map((sug) => (
              <button
                type="button"
                key={sug}
                className="faq-suggestion-pill"
                onClick={() => setQuery(sug)}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        <div className="faq-categories">
          <button
            type="button"
            className={`faq-cat-pill ${activeCategory === null ? 'is-active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          {groups.map((g) => (
            <button
              type="button"
              key={g.title}
              className={`faq-cat-pill ${activeCategory === g.title ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(g.title)}
            >
              {g.title}
            </button>
          ))}
        </div>
      </div>

      <div className="faq-content">
        {filteredGroups.length === 0 ? (
          <div
            className="container empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--s-3)',
            }}
          >
            <p>{isAr ? 'لم نجد سؤالاً مطابقاً لبحثك.' : 'No matching questions found.'}</p>
            <LinkButton href={localePath(labels.locale, '/contact')} variant="default" size="sm">
              {isAr ? 'اسألنا هذا السؤال مباشرة' : 'Ask us directly'}
            </LinkButton>
          </div>
        ) : (
          filteredGroups.map((g, i) => (
            <section key={g!.title} className="section faq-section">
              <div className="container">
                <div className="faq-panel">
                  <div className="faq-panel__head">
                    <span className="faq-panel__num">{String(i + 1).padStart(2, '0')}</span>
                    <h2 className="faq-panel__title">{g!.title}</h2>
                  </div>
                  <div className="faq-panel__items">
                    {g!.items.map((f) => (
                      <details key={f.q} className="faq-item">
                        <summary className="faq-item__summary">
                          <strong>{f.q}</strong>
                          <span className="faq-item__icon">
                            <Plus className="icon-plus" size={16} />
                            <Minus className="icon-minus" size={16} />
                          </span>
                        </summary>
                        <div className="faq-item__body">
                          <p>{f.a}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))
        )}
      </div>

      <section className="section faq-cta-section">
        <div className="container">
          <div className="faq-cta-card reveal">
            <h2>{labels.contactCtaTitle}</h2>
            <p>{labels.contactCtaBody}</p>
            <div className="faq-cta-card__actions">
              <LinkButton
                href={localePath(labels.locale, '/contact')}
                variant="primary"
                size="lg"
                trailing={<Arrow size={17} className="arrow" aria-hidden="true" />}
              >
                {labels.contactCtaButton}
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
