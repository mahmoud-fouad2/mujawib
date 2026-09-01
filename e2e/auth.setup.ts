import { mkdirSync } from 'node:fs'
import { expect, test as setup } from '@playwright/test'
import { assertSafeTarget, credentialsFor, type RoleKey } from './roles'

/**
 * Signs in once per role and saves the session, so the specs that follow
 * start already authenticated.
 *
 * Signing in inside every test would triple the runtime and, more importantly,
 * make every failure ambiguous: a red console test would mean either the
 * console is broken or sign-in is. Doing it once here keeps that distinction.
 */

async function signIn(page: import('@playwright/test').Page, role: RoleKey, baseURL?: string) {
  assertSafeTarget(baseURL)
  const creds = credentialsFor(role)
  mkdirSync('.auth', { recursive: true })

  await page.goto('/sign-in')
  await page.getByLabel(/البريد|email/i).fill(creds.email)
  await page.getByLabel(/كلمة المرور|password/i).fill(creds.password)
  await page.getByRole('button', { name: /دخول|تسجيل|sign in/i }).click()

  // Two-factor is mandatory for operators, so a redirect there is a correct
  // outcome that this fixture cannot complete — say so precisely rather than
  // failing on a generic timeout twenty seconds later.
  await page.waitForURL(/\/(console|portal|two-factor|account\/security)/, { timeout: 20_000 })
  const url = page.url()
  if (url.includes('/two-factor') || url.includes('/account/security')) {
    throw new Error(
      `The ${role} test account requires two-factor. Use an account with 2FA already ` +
        'enrolled and a seeded session, or disable it for that account on the test database.',
    )
  }

  await expect(page).toHaveURL(new RegExp(creds.landing))
  await page.context().storageState({ path: creds.storageState })
}

setup('authenticate as operator', async ({ page, baseURL }) => {
  await signIn(page, 'operator', baseURL)
})

setup('authenticate as client', async ({ page, baseURL }) => {
  await signIn(page, 'client', baseURL)
})
