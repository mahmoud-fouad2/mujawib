'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { SiteCopy } from '@/lib/content/site'
import { num } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

export type IndustryPack = {
  packKey: string
  name: string
  version: string
  clients: number
  flows: string[]
}

/** One image per sector — switching the tab switches the scene, not just the text. */
const SCENE: Record<string, string> = {
  medical: '/images/industries/medical-clean-2027.webp',
  realestate: '/images/industries/real-estate-clean-2027.webp',
  auto: '/images/industries/automotive-clean-2027.webp',
  reception: '/images/industries/customer-service-clean-2027.webp',
}

const FALLBACK_SCENE = '/images/industries/customer-service-clean-2027.webp'
const ORDER = ['medical', 'realestate', 'auto', 'reception']

function sceneFor(key: string) {
  return SCENE[key] ?? FALLBACK_SCENE
}

export function Industries({
  locale,
  copy,
  packs,
}: {
  locale: Locale
  copy: SiteCopy
  packs: IndustryPack[]
}) {
  const known = ORDER.filter((k) => packs.some((p) => p.packKey === k))
  const [active, setActive] = useState(known[0] ?? 'medical')

  const pack = packs.find((p) => p.packKey === active)
  const text = copy.industries.packs[active]

  if (!text) return null

  return (
    <div className="sector">
      <div className="sector__tabs" role="tablist" aria-label={copy.industries.label}>
        {known.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === active}
            className={`sector__tab${key === active ? ' is-active' : ''}`}
            onClick={() => setActive(key)}
          >
            {copy.industries.packs[key]?.title ?? key}
          </button>
        ))}
      </div>

      <div className="sector__panel" role="tabpanel">
        <div className="sector__scene">
          {/* All scenes stay mounted so switching never flashes an empty frame. */}
          {known.map((key) => (
            <Image
              key={key}
              src={sceneFor(key)}
              alt=""
              fill
              sizes="(max-width: 980px) 100vw, 46vw"
              className={`sector__img${key === active ? ' is-active' : ''}`}
            />
          ))}
          <span className="sector__shade" aria-hidden="true" />
          <span className="sector__caption">{text.moment}</span>
        </div>

        <div className="sector__copy">
          <h3>{text.title}</h3>
          <p>{text.body}</p>

          {pack ? (
            <>
              <div className="sector__flows">
                {pack.flows.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              <dl className="sector__facts">
                <div>
                  <dt>{locale === 'ar' ? 'شركات تشغّله' : 'Businesses running it'}</dt>
                  <dd className="mono">{num(pack.clients)}</dd>
                </div>
                <div>
                  <dt>{locale === 'ar' ? 'نسخة القالب' : 'Pack version'}</dt>
                  <dd className="mono">{pack.version}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
