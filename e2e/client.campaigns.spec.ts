import { expect, test } from '@playwright/test'

/**
 * Outbound campaigns from the client's side of the approval gate.
 *
 * The assertion that matters most here is a negative one: a client must be
 * able to build and submit a campaign and must never be offered a control
 * that starts one. The server action refuses regardless — this checks the
 * screen agrees with it.
 */

test.describe('client campaigns', () => {
  test('the campaigns page renders with its suppression list', async ({ page }) => {
    const response = await page.goto('/portal/campaigns')
    expect(response?.status()).toBe(200)
    await expect(page).not.toHaveURL(/\/sign-in|\/access-denied/)
    await expect(page.getByRole('heading', { name: /حملات الاتصال الصادر/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /قائمة الحظر/ })).toBeVisible()
    await expect(page.getByText(/Application error|Unhandled Runtime Error/i)).toHaveCount(0)
  })

  test('a client is never offered a control that starts calling', async ({ page }) => {
    // The server action refuses regardless, but the button must not be there
    // either: a control that always fails reads as broken rather than absent.
    await page.goto('/portal/campaigns')
    await expect(page.getByRole('button', { name: 'تشغيل', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'اعتماد', exact: true })).toHaveCount(0)
  })

  test('the campaign form demands a legal basis before anything else', async ({ page }) => {
    await page.goto('/portal/campaigns')
    const create = page.getByRole('button', { name: 'حملة جديدة' })
    if ((await create.count()) === 0) test.skip(true, 'this role cannot create campaigns')
    await create.click()

    const consent = page.getByLabel('الأساس القانوني للاتصال')
    await expect(consent).toBeVisible()
    // There is no "purchased list" option, and there must never be one.
    await expect(consent.getByRole('option')).toHaveCount(3)
    await expect(page.getByText(/قائمة مشتراة/)).toBeVisible()
  })

  test('saving is blocked until the script is long enough to review', async ({ page }) => {
    await page.goto('/portal/campaigns')
    const create = page.getByRole('button', { name: 'حملة جديدة' })
    if ((await create.count()) === 0) test.skip(true, 'this role cannot create campaigns')
    await create.click()

    await page.getByLabel('اسم الحملة').fill('اختبار آلي')
    const save = page.getByRole('button', { name: /حفظ المسودة/ })
    await expect(save).toBeDisabled()

    await page.getByLabel('تعليمات المكالمة').fill('نص قصير')
    await expect(save).toBeDisabled()
  })

  test('the do-not-call form says the block does not expire', async ({ page }) => {
    await page.goto('/portal/campaigns')
    const block = page.getByRole('button', { name: 'حظر رقم' })
    if ((await block.count()) === 0) test.skip(true, 'this role cannot manage campaigns')
    await block.click()
    await expect(page.getByText(/بلا تاريخ انتهاء/)).toBeVisible()
  })
})
