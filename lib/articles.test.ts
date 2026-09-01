import { describe, expect, it } from 'vitest'
import {
  articleOutline,
  coverArt,
  readingMinutes,
  renderArticleBody,
  slugify,
} from '@/lib/articles'

describe('renderArticleBody', () => {
  it('escapes HTML before it formats anything', () => {
    // The article body is operator input rendered onto a public page, so the
    // renderer is a security boundary. A tag in the source must come out as
    // text, not as markup, whatever else surrounds it.
    const html = renderArticleBody('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('cannot be tricked into producing a tag through formatting', () => {
    const html = renderArticleBody('**<img src=x onerror=alert(1)>**')
    expect(html).toContain('<strong>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('refuses to build a link out of a javascript: URL', () => {
    // The property that matters is that no anchor is produced. The text is
    // left as inert prose, which is harmless — a visitor sees the characters
    // and there is nothing to click.
    const html = renderArticleBody('[click](javascript:alert(1))')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('href')
    expect(html).toBe('<p>[click](javascript:alert(1))</p>')
  })

  it('refuses protocol-relative and data URLs too', () => {
    expect(renderArticleBody('[x](//evil.example)')).not.toContain('<a ')
    expect(renderArticleBody('[x](data:text/html,<script>)')).not.toContain('<a ')
  })

  it('allows internal paths and https, and marks external links safe', () => {
    expect(renderArticleBody('[الأسعار](/pricing)')).toContain('<a href="/pricing">')
    const external = renderArticleBody('[مرجع](https://example.com/x)')
    expect(external).toContain('rel="noopener noreferrer"')
    expect(external).toContain('target="_blank"')
  })

  it('renders the constructs the content actually uses', () => {
    const html = renderArticleBody(
      ['## عنوان', '', 'فقرة **مهمة**.', '', '- أولى', '- ثانية', '', '> اقتباس'].join('\n'),
    )
    expect(html).toContain('<h2>عنوان</h2>')
    expect(html).toContain('<strong>مهمة</strong>')
    expect(html).toContain('<ul><li>أولى</li><li>ثانية</li></ul>')
    expect(html).toContain('<blockquote>اقتباس</blockquote>')
  })

  it('keeps ordered and unordered lists apart', () => {
    const html = renderArticleBody(['1. واحد', '2. اثنان'].join('\n'))
    expect(html).toContain('<ol>')
    expect(html).not.toContain('<ul>')
  })

  it('joins wrapped lines into one paragraph', () => {
    const html = renderArticleBody('سطر أول\nسطر ثانٍ')
    expect(html).toBe('<p>سطر أول سطر ثانٍ</p>')
  })
})

describe('articleOutline', () => {
  it('returns only the second-level headings', () => {
    const outline = articleOutline(['## أ', '### ب', '## ج', 'نص'].join('\n'))
    expect(outline).toEqual(['أ', 'ج'])
  })
})

describe('readingMinutes', () => {
  it('never claims less than a minute', () => {
    expect(readingMinutes('كلمتان فقط')).toBe(1)
  })

  it('rounds up, because a partial minute is still a minute of the reader’s', () => {
    const words = Array.from({ length: 200 }, () => 'كلمة').join(' ')
    expect(readingMinutes(words)).toBe(2)
  })
})

describe('slugify', () => {
  it('keeps Arabic readable rather than transliterating it', () => {
    expect(slugify('موظف استقبال بالذكاء الاصطناعي')).toBe('موظف-استقبال-بالذكاء-الاصطناعي')
  })

  it('drops punctuation that would break a URL', () => {
    expect(slugify('كم تخسر؟ (حساب حقيقي)')).toBe('كم-تخسر-حساب-حقيقي')
  })

  it('never produces leading, trailing or doubled separators', () => {
    const slug = slugify('  --  عنوان   به   فراغات  --  ')
    expect(slug.startsWith('-')).toBe(false)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug).not.toContain('--')
  })
})

describe('coverArt', () => {
  it('is stable for a slug, so an article keeps its cover', () => {
    expect(coverArt('abc')).toEqual(coverArt('abc'))
  })

  it('separates adjacent articles', () => {
    expect(coverArt('abc').hueA).not.toBe(coverArt('abd').hueA)
  })

  it('stays inside the ranges the SVG expects', () => {
    for (const slug of ['a', 'مقال', 'x-y-z', '']) {
      const art = coverArt(slug)
      expect(art.hueA).toBeGreaterThanOrEqual(0)
      expect(art.hueA).toBeLessThan(360)
      expect(art.figure).toBeGreaterThanOrEqual(0)
      expect(art.figure).toBeLessThan(4)
    }
  })
})
