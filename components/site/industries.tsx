'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { LinkButton } from '@/components/ui/button'
import type { SiteCopy } from '@/lib/content/site'
import { flowLabel } from '@/lib/content/vocabulary'
import { num } from '@/lib/format'
import { isRtl, type Locale, localePath } from '@/lib/i18n'

export type IndustryPack = {
  packKey: string
  name: string
  version: string
  clients: number
  flows: string[]
}

/** One image per sector — switching the tab switches the scene, not just the text. */
const SCENE: Record<string, string> = {
  medical: '/images/industries/clinic-reception-voice-2027.webp',
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
  const Arrow = isRtl(locale) ? ArrowLeft : ArrowRight

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
              priority={key === 'medical'}
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
              {/* The two facts that used to sit here were a client count that
                  reads 0 until the sector has customers, and an internal pack
                  version number that means nothing to a business owner. The
                  flows are the part a buyer can judge. */}
              <div className="sector__flows">
                {pack.flows.map((f) => (
                  <span key={f}>{flowLabel(f, locale)}</span>
                ))}
              </div>
              {pack.clients > 0 ? (
                <p className="sector__fact">
                  {locale === 'ar'
                    ? `${num(pack.clients)} من عملائنا يشغّلون هذا القطاع اليوم.`
                    : `${num(pack.clients)} of our clients run this sector today.`}
                </p>
              ) : null}
            </>
          ) : null}

          <LinkButton
            href={localePath(locale, '/contact')}
            variant="primary"
            trailing={<Arrow size={15} className="arrow" aria-hidden="true" />}
          >
            {locale === 'ar' ? `جرّب سيناريو ${text.title}` : `Try a ${text.title} scenario`}
          </LinkButton>
        </div>
      </div>
    </div>
  )
}
