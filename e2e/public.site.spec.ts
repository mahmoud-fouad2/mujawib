import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The public site, signed out.
 *
 * Covers the two things that break silently and cost money: a marketing page
 * that renders blank because a query changed shape, and a route that leaks a
 * signed-in surface to an anonymous visitor.
 */

const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/how-it-works',
  '/faq',
  '/security',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/blog',
  '/en',
  '/en/pricing',
  '/en/blog',
]

test.describe('public pages', () => {
  for (const path of PUBLIC_ROUTES) {
    test(`${path} renders with real content`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should return 200`).toBe(200)

      // A heading proves the page rendered, not just that the shell did — the
      // failure mode being guarded against is a 200 with an empty main.
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(page.locator('main')).not.toBeEmpty()

      // A Next.js error boundary renders a 200 too, so assert its absence.
      await expect(page.getByText(/Application error|Unhandled Runtime Error/i)).toHaveCount(0)
    })
  }

  test('every public page declares a title and description', async ({ page }) => {
    for (const path of ['/', '/pricing', '/blog', '/en']) {
      await page.goto(path)
      await expect(page).toHaveTitle(/.{10,}/)
      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description?.length ?? 0, `${path} needs a description`).toBeGreaterThan(50)
    }
  })

  test('the Arabic site renders right to left', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })

  test('the English site renders left to right', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('the home page has no serious accessibility violations', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the sitemap lists real URLs and the robots file points at it', async ({ page }) => {
    const sitemap = await page.goto('/sitemap.xml')
    expect(sitemap?.status()).toBe(200)
    const body = await sitemap!.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('/blog')

    const robots = await page.goto('/robots.txt')
    expect(robots?.status()).toBe(200)
    expect(await robots!.text()).toMatch(/sitemap/i)
  })
})

test.describe('signed-out access control', () => {
  for (const path of ['/console', '/console/clients', '/portal', '/portal/calls', '/onboarding']) {
    test(`${path} redirects an anonymous visitor to sign-in`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in/)
    })
  }
})
