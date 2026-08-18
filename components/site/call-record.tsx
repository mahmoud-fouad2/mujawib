'use client'

import { Check, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { duration } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

export type RecordItem =
  | { kind: 'turn'; at: number; role: 'agent' | 'caller'; text: string }
  | { kind: 'tool'; at: number; name: string; success: boolean; latencyMs: number | null }

export type CallRecordProps = {
  locale: Locale
  title: string
  meta: string
  items: RecordItem[]
  outcome: { label: string; detail: string } | null
  totalSeconds: number | null
  /** Plays the record back line by line. Off for the static previews. */
  animate?: boolean
}

const ROLE_LABEL: Record<Locale, { agent: string; caller: string }> = {
  ar: { agent: 'مُجاوِب', caller: 'المتصل' },
  en: { agent: 'Mujawib', caller: 'Caller' },
}

/**
 * The product's real artifact: a time-ordered record of one call, with the tool
 * executions that made the outcome true. This is the hero rather than a stock
 * photo because it is the thing the customer is actually buying.
 */
export function CallRecord({
  locale,
  title,
  meta,
  items,
  outcome,
  totalSeconds,
  animate = true,
}: CallRecordProps) {
  const [revealed, setRevealed] = useState(animate ? 0 : items.length)
  const labels = ROLE_LABEL[locale] ?? ROLE_LABEL.ar

  useEffect(() => {
    if (!animate) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setRevealed(items.length)
      return
    }
    let i = 0
    const tick = window.setInterval(() => {
      i += 1
      setRevealed(i)
      if (i >= items.length) window.clearInterval(tick)
    }, 420)
    return () => window.clearInterval(tick)
  }, [animate, items.length])

  const complete = revealed >= items.length

  return (
    <figure className="record">
      <div className="record__head">
        <span className="wave" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ animationDelay: `${i * 110}ms` }} />
          ))}
        </span>
        <span className="record__title">
          <strong>{title}</strong>
          <span>{meta}</span>
        </span>
        <span className="record__timer">{duration(totalSeconds)}</span>
      </div>

      <div className="record__body">
        {items.slice(0, revealed).map((item, i) =>
          item.kind === 'turn' ? (
            <div
              key={`${item.kind}-${item.at}`}
              className={`line line--${item.role}`}
              style={{ animationDelay: animate ? '0ms' : `${i * 40}ms` }}
            >
              <span className="line__at">{duration(item.at)}</span>
              <div className="line__body">
                <span className="line__who">
                  {item.role === 'agent' ? labels.agent : labels.caller}
                </span>
                <p className="line__text">{item.text}</p>
              </div>
            </div>
          ) : (
            <div key={`${item.kind}-${item.at}`} className="line line--tool">
              <span className="line__at">{duration(item.at)}</span>
              <div className="line__body">
                <Wrench size={13} aria-hidden="true" />
                <code>{item.name}</code>
                {item.success ? (
                  <Check size={13} aria-hidden="true" style={{ color: 'var(--good)' }} />
                ) : null}
                {item.latencyMs ? <span className="line__meta">{item.latencyMs}ms</span> : null}
              </div>
            </div>
          ),
        )}
      </div>

      {outcome && complete ? (
        <figcaption className="record__outcome">
          <Check size={16} aria-hidden="true" />
          <span>{outcome.label}</span>
          <span className="mono">{outcome.detail}</span>
        </figcaption>
      ) : null}
    </figure>
  )
}
