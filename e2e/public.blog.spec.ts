import { expect, test } from '@playwright/test'

/**
 * The blog, which exists to be found. These assertions are about whether a
 * search engine can read it, not only whether a human can.
 */
test.describe('blog', () => {
  test('the index links to articles, or says there are none', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const links = page.locator('a[href*="/blog/"]')
    const count = await links.count()
    if (count === 0) {
      // A correct state before the first publish — assert it explicitly
      // rather than letting an empty page pass as a rendered one.
      await expect(page.getByText(/لا توجد مقالات|No articles/)).toBeVisible()
      test.skip(true, 'no articles published yet')
      return
    }
    expect(count).toBeGreaterThan(0)
  })

  test('an article page carries the structured data a result needs', async ({ page }) => {
    await page.goto('/blog')
    const first = page.locator('a[href*="/blog/"]').first()
    test.skip((await first.count()) === 0, 'no articles published yet')

    await first.click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = scripts.flatMap((raw) => {
      const parsed = JSON.parse(raw)
      return (Array.isArray(parsed) ? parsed : [parsed]).map((entry) => entry['@type'])
    })
    expect(types).toContain('Article')
    expect(types).toContain('BreadcrumbList')
  })

  test('article bodies never emit script tags', async ({ page }) => {
    await page.goto('/blog')
    const first = page.locator('a[href*="/blog/"]').first()
    test.skip((await first.count()) === 0, 'no articles published yet')
    await first.click()

    // The renderer escapes before it formats; this proves that end to end
    // rather than only in the unit test.
    const inlineScripts = await page.locator('.article__body script').count()
    expect(inlineScripts).toBe(0)
  })
})
