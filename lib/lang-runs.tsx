import type { ReactNode } from 'react'

/**
 * Arabic runs inside English copy, marked so a screen reader switches voice.
 *
 * The English pages carry Arabic on purpose — the code-switching example on the
 * home page, and the whole call transcript, which stays in Arabic because that
 * is the product. Untagged, a screen reader on an `<html lang="en">` page reads
 * those characters with an English voice and produces noise (WCAG 3.1.2,
 * Language of Parts).
 *
 * `lang` only, deliberately no `dir`. The direction is already correct: the
 * browser's bidi algorithm derives it from the characters themselves. Forcing
 * `dir="rtl"` onto each run would create separate embeddings inside a phrase
 * like "أبغى appointment بكرة الصبح", and reorder a sentence that renders
 * correctly today.
 */
const ARABIC_RUN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿][؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿\s،؛؟]*/gu

export function withArabicRuns(text: string): ReactNode {
  ARABIC_RUN.lastIndex = 0
  if (!ARABIC_RUN.test(text)) return text
  ARABIC_RUN.lastIndex = 0

  const parts: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(ARABIC_RUN)) {
    const start = match.index
    // A run can end on the whitespace that separates it from the next Latin
    // word; that space belongs to neither language, so leave it outside.
    const run = match[0].replace(/\s+$/, '')
    if (!run) continue

    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <span key={`${start}-${run}`} lang="ar">
        {run}
      </span>,
    )
    cursor = start + run.length
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}
