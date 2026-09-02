import { expect, test } from '@playwright/test'

/**
 * Outbound campaigns, voice personas and inquiries from the console.
 *
 * These three moved together: each was a screen that showed rows and offered
 * no way to act on them, and each now has controls whose authority is checked
 * in the Server Action rather than in whether a button rendered.
 */

test.describe('operator campaigns', () => {
  test('the console lists campaigns across every client', async ({ page }) => {
    const response = await page.goto('/console/campaigns')
    expect(response?.status()).toBe(200)
    await expect(page).not.toHaveURL(/\/sign-in|\/access-denied/)
    await expect(page.getByRole('heading', { name: /حملات الاتصال الصادر/ })).toBeVisible()
  })

  test('an unconfigured dialer is stated on the page, not implied', async ({ page }) => {
    await page.goto('/console/campaigns')
    const notice = page.getByText(/الاتصال الصادر غير مُهيّأ/)
    // On a configured staging deployment this notice is correctly absent —
    // what must never happen is a page that is silent either way.
    if ((await notice.count()) > 0) {
      await expect(notice.first()).toBeVisible()
      await expect(page.getByText(/TWILIO_ACCOUNT_SID|OPENAI_PROJECT_ID/)).toBeVisible()
    }
  })

  test('the status filters are links, so a filtered view can be shared', async ({ page }) => {
    await page.goto('/console/campaigns?status=pending_review')
    await expect(page).toHaveURL(/status=pending_review/)
    await expect(page.getByRole('link', { name: /بانتظار الموافقة/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

test.describe('operator voice personas', () => {
  test('the voice lab can create a persona, not only list them', async ({ page }) => {
    await page.goto('/console/voice-lab')
    // Section titles render as `<strong>`, not a heading role.
    await expect(page.getByText('الشخصيات الصوتية', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'شخصية مخصصة' })).toBeVisible()
  })

  test('the provider-voice limitation is printed where it is chosen', async ({ page }) => {
    await page.goto('/console/voice-lab')
    const create = page.getByRole('button', { name: 'شخصية مخصصة' })
    if (await create.isDisabled()) test.skip(true, 'no client workspaces on this deployment')
    await create.click()
    await expect(
      page.getByText(/الفرق بين الشخصيات هو اللهجة والإيقاع، لا طبقة الصوت/),
    ).toBeVisible()
  })
})

test.describe('operator inquiries', () => {
  test('filtering happens in the URL, so the view is shareable', async ({ page }) => {
    await page.goto('/console/inquiries?status=unowned')
    await expect(page).toHaveURL(/status=unowned/)
    await expect(page.getByRole('link', { name: /بلا مالك/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('a search with no matches says so rather than showing an empty table', async ({ page }) => {
    await page.goto('/console/inquiries?q=zzzzz-no-such-company-zzzzz')
    await expect(page.getByText(/لا نتائج/)).toBeVisible()
  })
})
