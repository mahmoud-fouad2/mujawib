import { mkdirSync } from 'node:fs'
import { expect, test as setup } from '@playwright/test'
import { assertSafeTarget, credentialsFor, type RoleKey, totpCode } from './roles'

/**
 * Signs in once per role and saves the session, so the specs that follow
 * start already authenticated.
 *
 * Signing in inside every test would triple the runtime and, more importantly,
 * make every failure ambiguous: a red console test would mean either the
 * console is broken or sign-in is. Doing it once here keeps that distinction.
 */

/**
 * Generous on purpose, and measured rather than guessed.
 *
 * Completing an operator sign-in is four sequential round trips — the TOTP
 * check, two redirects through `/auth/continue`, then the console's own render
 * — and every one of them talks to the database. Against a managed database in
 * another region, with a dev server compiling routes on first hit, that came
 * to just over twenty seconds and failed a check that was in fact working.
 *
 * The right response to a slow-but-correct path is a timeout that fits it. The
 * specs themselves keep the default; only signing in gets this.
 */
const SIGN_IN_TIMEOUT = 60_000

async function signIn(page: import('@playwright/test').Page, role: RoleKey, baseURL?: string) {
  assertSafeTarget(baseURL)
  const creds = credentialsFor(role)
  mkdirSync('.auth', { recursive: true })

  await page.goto('/sign-in')
  // By id, not by label. The password field's show/hide toggle carries
  // `aria-label="إظهار كلمة المرور"`, so a label match finds two controls and
  // resolves to neither — a strict-mode failure that reads as "field missing".
  await page.locator('#email').fill(creds.email)
  await page.locator('#password').fill(creds.password)
  await page.getByRole('button', { name: /^(دخول|تسجيل الدخول|sign in)$/i }).click()

  await expect(page).toHaveURL(/\/(console|portal|two-factor|account\/security)/, {
    timeout: SIGN_IN_TIMEOUT,
  })

  // Two-factor is mandatory before either console opens, so completing it is
  // part of signing in, not an obstacle to route around. This fixture used to
  // throw here, which meant the suite could only ever reach signed-out pages —
  // every assertion about what a role can and cannot see was unreachable.
  if (page.url().includes('/two-factor')) {
    // Structurally, not by text. The challenge page has method-switch buttons
    // and an escape link that all contain the same words as the submit button,
    // so a name match resolves to whichever happens to come first.
    await page.locator('#two-factor-code').fill(totpCode(creds.totpSecret))
    await page.locator('form.auth__form button[type="submit"]').click()
    // `waitForURL` waits for a load event by default, and this navigation is
    // client-side — the router pushes, no document loads, and the wait times
    // out on a page that has already arrived. Assert the URL instead.
    await expect(page).toHaveURL(/\/(console|portal|account\/security)/, {
      timeout: SIGN_IN_TIMEOUT,
    })
  }

  // Landing here means the account has no enrolment at all, which `pnpm
  // e2e:seed` creates — a different failure from a wrong code, and worth
  // saying so rather than timing out on a page that will never navigate.
  if (page.url().includes('/account/security')) {
    throw new Error(
      `The ${role} account has no two-factor enrolment. Run \`pnpm e2e:seed\` and export ` +
        'the MUJAWIB_E2E_* values it prints.',
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
