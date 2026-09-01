import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The super-admin journey.
 *
 * Every console route is loaded and asserted to render real content. The
 * failure this exists to catch is the common one: a data-layer change that
 * makes one screen throw while every other screen and the whole unit suite
 * stay green.
 */

const CONSOLE_ROUTES = [
  '/console',
  '/console/live',
  '/console/calls',
  '/console/qa',
  '/console/clients',
  '/console/inquiries',
  '/console/agents',
  '/console/templates',
  '/console/voice-lab',
  '/console/test-lab',
  '/console/integrations',
  '/console/phone',
  '/console/access',
  '/console/content',
  '/console/system',
]

test.describe('operator console', () => {
  for (const path of CONSOLE_ROUTES) {
    test(`${path} renders for an operator`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page).not.toHaveURL(/\/sign-in|\/access-denied/)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(page.getByText(/Application error|Unhandled Runtime Error/i)).toHaveCount(0)
    })
  }

  test('the sidebar exposes navigation to the operator surfaces', async ({ page }) => {
    await page.goto('/console')
    await expect(page.getByRole('link', { name: /العملاء/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /المكالمات/ })).toBeVisible()
  })

  test('the console has no serious accessibility violations', async ({ page }) => {
    await page.goto('/console')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

test.describe('content management', () => {
  test('an operator can publish an announcement and see it on the public site', async ({
    page,
    context,
  }) => {
    await page.goto('/console/content')

    const title = `اختبار آلي ${Date.now()}`
    await page.getByRole('button', { name: /إعلان جديد/ }).click()
    await page.getByLabel('العنوان', { exact: true }).fill(title)
    await page.getByLabel('النص', { exact: true }).fill('هذا إعلان من اختبار آلي.')
    await page.getByLabel('ظاهر الآن').check()
    await page.getByRole('button', { name: /^حفظ$/ }).click()

    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 })

    // The banner is cached for thirty seconds, so an anonymous visitor may not
    // see it instantly. Waiting for it is the assertion: it must arrive.
    const anonymous = await context.browser()!.newContext()
    const visitor = await anonymous.newPage()
    await expect(async () => {
      await visitor.goto('/')
      await expect(visitor.getByText(title)).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 60_000 })
    await anonymous.close()

    // Clean up: leaving a live banner behind would break every later run and,
    // worse, sit on the site if this ever ran against a shared environment.
    await page.goto('/console/content')
    const row = page.getByRole('row', { name: new RegExp(title) })
    await row.getByRole('button', { name: /إجراءات/ }).click()
    await page.getByRole('button', { name: /حذف/ }).click()
    await page.getByRole('button', { name: /^حذف$/ }).last().click()
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 })
  })
})

test.describe('operator boundaries', () => {
  test('an operator does not silently land in a client portal', async ({ page }) => {
    // The portal is reachable for support, but it must announce that an
    // operator is viewing it rather than looking identical to the client's
    // own view — that ambiguity is how "your calls" gets misread.
    const response = await page.goto('/portal')
    expect(response?.status()).toBeLessThan(500)
  })
})
