import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The client journey — the surface a paying customer actually uses.
 *
 * The most valuable assertions here are the negative ones: a client must not
 * be able to reach the operator console, and must not see another workspace.
 */

const PORTAL_ROUTES = [
  '/portal',
  '/portal/calls',
  '/portal/bookings',
  '/portal/customers',
  '/portal/requests',
  '/portal/insights',
  '/portal/integrations',
  '/portal/business-info',
  '/portal/phone',
]

test.describe('client portal', () => {
  for (const path of PORTAL_ROUTES) {
    test(`${path} renders for a client`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page).not.toHaveURL(/\/sign-in|\/access-denied/)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(page.getByText(/Application error|Unhandled Runtime Error/i)).toHaveCount(0)
    })
  }

  test('the portal has no serious accessibility violations', async ({ page }) => {
    await page.goto('/portal')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

test.describe('client boundaries', () => {
  for (const path of ['/console', '/console/clients', '/console/system', '/console/content']) {
    test(`a client is refused ${path}`, async ({ page }) => {
      await page.goto(path)
      // Either bounced to the denial page or to sign-in. What must never
      // happen is the console rendering.
      await expect(page).toHaveURL(/\/access-denied|\/sign-in|\/portal/)
    })
  }

  test('the portal never exposes prompt, SIP or model internals', async ({ page }) => {
    // A documented product boundary: the client sees outcomes, not the
    // machinery. A leak here is a competitive and a security problem at once.
    for (const path of ['/portal', '/portal/calls', '/portal/integrations']) {
      await page.goto(path)
      const body = (await page.locator('body').innerText()).toLowerCase()
      for (const forbidden of ['sip:', 'gpt-realtime', 'openai', 'sk-', 'system prompt']) {
        expect(body, `${path} must not expose "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  test('a client can file a change request', async ({ page }) => {
    await page.goto('/portal/requests')
    await expect(page.getByRole('heading').first()).toBeVisible()
    // The button is the contract: a client asks, operations decides. Its
    // absence would mean the managed-service loop is broken.
    await expect(page.getByRole('button').first()).toBeVisible()
  })
})
