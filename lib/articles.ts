/**
 * Article helpers: reading time, slugs, cover art, and a deliberately small
 * Markdown renderer.
 *
 * No Markdown library. Articles are written by the operator team into a
 * database field that is rendered onto a public page, which makes the
 * renderer a security boundary, not a convenience: a general-purpose parser
 * with raw-HTML passthrough would turn the article editor into stored XSS
 * against every visitor. This handles the six constructs the content actually
 * uses, escapes everything first, and emits nothing it was not asked for.
 */

export const ARTICLE_CATEGORIES = [
  'guide',
  'industry',
  'comparison',
  'operations',
  'security',
] as const

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export const ARTICLE_CATEGORY_LABEL: Record<ArticleCategory, string> = {
  guide: 'دليل',
  industry: 'قطاعات',
  comparison: 'مقارنة',
  operations: 'تشغيل',
  security: 'خصوصية وأمان',
}

/**
 * Arabic reads at roughly 180 words per minute for informational prose —
 * slower than the 230 usually quoted for English. The number is a courtesy to
 * the reader, so it rounds up and never claims less than a minute.
 */
const WORDS_PER_MINUTE = 180

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/**
 * A URL-safe slug. Arabic titles are kept as Arabic slugs rather than
 * transliterated: Google indexes them correctly, they are readable to the
 * audience, and a transliteration scheme is one more thing to get wrong.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ً-ْ]/g, '') // strip Arabic diacritics
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90)
}

/* ─── cover art ──────────────────────────────────────────────────────────── */

/**
 * A deterministic cover for each article, drawn rather than photographed.
 *
 * Stock photography of a headset on a desk says nothing and costs bytes on
 * every list view. This derives two hues from the slug, so an article always
 * gets the same cover and no two adjacent articles collide, and renders as
 * inline SVG — no request, no layout shift, and it inherits the page's own
 * palette in both themes.
 */
export function coverSeed(slug: string): number {
  let hash = 0
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 100_000
  }
  return hash
}

export type CoverArt = {
  hueA: number
  hueB: number
  /** 0–3, selecting which of four generated figures to draw. */
  figure: number
}

export function coverArt(slug: string): CoverArt {
  const seed = coverSeed(slug)
  const hueA = seed % 360
  return {
    hueA,
    // Analogous rather than complementary: a 40° step keeps the two colours
    // in the same family, so a grid of covers reads as one set.
    hueB: (hueA + 40) % 360,
    figure: seed % 4,
  }
}

/* ─── markdown ───────────────────────────────────────────────────────────── */

type Block =
  | { type: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Inline formatting, applied only after the text has been escaped.
 *
 * Order matters: escaping first means a `<script>` in the source is already
 * inert text by the time any tag is introduced, so no construct below can
 * reconstitute it. Links are restricted to internal paths and https, which
 * rules out `javascript:` without needing to enumerate what is dangerous.
 */
function renderInline(text: string): string {
  return (
    escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // A single leading slash only. `//host` is protocol-relative and leaves
      // the site entirely despite looking like a path — the same trap
      // `safeAnnouncementHref` guards against. Anything else (`javascript:`,
      // `data:`, bare words) matches nothing and is left as inert text.
      .replace(/\[([^\]]+)\]\((\/(?!\/)[^\s)]*|https:\/\/[^\s)]+)\)/g, (_match, label, href) => {
        const external = String(href).startsWith('https://')
        const rel = external ? ' target="_blank" rel="noopener noreferrer"' : ''
        return `<a href="${href}"${rel}>${label}</a>`
      })
  )
}

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push({ type: 'p', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    blocks.push(list)
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: heading[1]?.length === 2 ? 'h2' : 'h3', text: heading[2] ?? '' })
      continue
    }

    if (line.startsWith('> ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'quote', text: line.slice(2) })
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      if (list?.type !== 'ul') {
        flushList()
        list = { type: 'ul', items: [] }
      }
      list.items.push(bullet[1] ?? '')
      continue
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      flushParagraph()
      if (list?.type !== 'ol') {
        flushList()
        list = { type: 'ol', items: [] }
      }
      list.items.push(numbered[1] ?? '')
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

/** Escaped, restricted HTML ready for `dangerouslySetInnerHTML`. */
export function renderArticleBody(markdown: string): string {
  return parseBlocks(markdown)
    .map((block) => {
      // Discriminating on the payload rather than the tag: `type` overlaps
      // across both variants as a union of literals, so `'items' in block` is
      // what actually narrows here.
      if ('items' in block) {
        const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join('')
        return `<${block.type}>${items}</${block.type}>`
      }
      if (block.type === 'quote') return `<blockquote>${renderInline(block.text)}</blockquote>`
      return `<${block.type}>${renderInline(block.text)}</${block.type}>`
    })
    .join('')
}

/** The H2s, for an in-page table of contents. */
export function articleOutline(markdown: string): string[] {
  const headings: string[] = []
  for (const block of parseBlocks(markdown)) {
    if (block.type === 'h2') headings.push(block.text)
  }
  return headings
}
