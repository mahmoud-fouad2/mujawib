import { createRequire } from 'node:module'
import AxeBuilder from '@axe-core/playwright'

const require = createRequire(import.meta.url)
const runtimeNodeModules =
  process.env.CODEX_NODE_MODULES ??
  'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'

function loadPlaywright() {
  try {
    return require('playwright')
  } catch {
    return require(`${runtimeNodeModules}/playwright`)
  }
}

const { chromium } = loadPlaywright()

const baseUrl = process.env.MUJAWIB_BASE_URL ?? 'http://localhost:3009'
const chromePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const routes = [
  '/',
  '/sign-in',
  '/forgot-password',
  '/reset-password?error=INVALID_TOKEN',
  '/auth/continue',
  '/access-pending',
  '/onboarding',
  '/console',
  '/console/live',
  '/console/clients',
  '/console/agents',
  '/console/calls',
  '/console/qa',
  '/console/templates',
  '/console/test-lab',
  '/console/voice-lab',
  '/console/integrations',
  '/console/phone',
  '/console/access',
  '/console/system',
  '/about',
  '/pricing',
  '/faq',
  '/access-denied',
  '/invite',
  '/portal',
  '/portal/calls',
  '/portal/bookings',
  '/portal/customers',
  '/portal/insights',
  '/portal/business-info',
  '/portal/integrations',
  '/portal/requests',
]

const viewports = [
  { name: 'mobile', width: 390, height: 1100 },
  { name: 'desktop', width: 1440, height: 1100 },
]

const forbiddenPortalTerms = [
  /\bprompt\b/i,
  /\bmodel\b/i,
  /\bSIP\b/i,
  /\bAPI\b/i,
  /\bschema\b/i,
  /أسرار الربط/,
  /النموذج/,
]

function routeUrl(route) {
  return new URL(route, baseUrl).toString()
}

function reachedAuthGate(page, route) {
  return (
    (route.startsWith('/console') ||
      route.startsWith('/portal') ||
      route.startsWith('/auth/continue') ||
      route.startsWith('/access-pending') ||
      route.startsWith('/onboarding')) &&
    new URL(page.url()).pathname === '/sign-in'
  )
}

async function gotoReady(page, route) {
  const response = await page.goto(routeUrl(route), {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  })
  await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {})
  return response
}

async function assertNoHorizontalOverflow(page, route, viewportName) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('*')]
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          className: String(el.className),
          text: (el.textContent ?? '').trim().slice(0, 60),
          left: rect.left,
          right: rect.right,
          width: rect.width,
        }
      })
      .filter(
        (item) =>
          item.width > 0 &&
          (item.right > document.documentElement.clientWidth + 1 || item.left < -1),
      )
      .slice(0, 5),
  }))

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      `${route} overflows on ${viewportName}: ${metrics.scrollWidth}/${metrics.clientWidth} ${JSON.stringify(metrics.offenders)}`,
    )
  }
}

async function assertPortalIsClientSafe(page, route) {
  if (!route.startsWith('/portal')) return
  const text = await page.locator('body').innerText()
  const leaked = forbiddenPortalTerms.find((term) => term.test(text))
  if (leaked) {
    throw new Error(`${route} contains client-facing technical term: ${leaked}`)
  }
}

async function assertAccessible(page, route, viewportName) {
  if (route !== '/' && route !== '/sign-in') return

  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blocking = result.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )

  if (blocking.length > 0) {
    const summary = blocking
      .map((violation) => `${violation.id}:${violation.nodes.length}`)
      .join(', ')
    throw new Error(`${route} accessibility failures on ${viewportName}: ${summary}`)
  }
}

async function assertVisible(page, selector, label) {
  const visible = await page.locator(selector).first().isVisible()
  if (!visible) {
    throw new Error(`${label} is not visible`)
  }
}

async function resilientClick(locator, label) {
  let lastError

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await locator.first().waitFor({ state: 'attached', timeout: 10_000 })
      await locator.first().evaluate((el) => el.click())
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }

  throw new Error(`${label} could not be clicked: ${lastError}`)
}

async function runInteractionChecks(browser, failures) {
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } })
    const page = await context.newPage()
    await gotoReady(page, '/')
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    await resilientClick(page.getByLabel('تبديل الوضع'), 'theme toggle')
    await page.waitForFunction(
      (before) => document.documentElement.dataset.theme !== before,
      initialTheme,
      { timeout: 10_000 },
    )
    await assertNoHorizontalOverflow(page, '/', 'mobile dark-toggle')
    console.log('ok interaction theme-toggle')
    await context.close()
  } catch (error) {
    failures.push(
      `interaction theme-toggle: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } })
    const page = await context.newPage()
    await gotoReady(page, '/console')
    if (reachedAuthGate(page, '/console')) {
      console.log('skip interaction command-surface (authenticated session required)')
    } else {
      await resilientClick(page.locator('.topbar__search'), 'command trigger')
      await assertVisible(page, '.palette', 'command surface')
      await page.keyboard.type('جودة')
      await assertVisible(page, '.palette__item', 'command result')
      await page.keyboard.press('Escape')
      console.log('ok interaction command-surface')
    }
    await context.close()
  } catch (error) {
    failures.push(
      `interaction command-surface: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } })
    const page = await context.newPage()
    await gotoReady(page, '/console/calls')
    if (reachedAuthGate(page, '/console/calls')) {
      console.log('skip interaction call-inspector (authenticated session required)')
    } else {
      await resilientClick(page.locator('.list-item'), 'call inbox row')
      await assertVisible(page, '.workbench__inspector', 'call inspector')
      await assertNoHorizontalOverflow(page, '/console/calls', 'mobile inspector')
      console.log('ok interaction call-inspector')
    }
    await context.close()
  } catch (error) {
    failures.push(
      `interaction call-inspector: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  })
  const failures = []

  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: viewport.name === 'mobile' ? 'dark' : 'light',
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      try {
        const response = await gotoReady(page, route)
        if (!response?.ok()) {
          throw new Error(`${response?.status() ?? 'no response'}`)
        }
        await assertNoHorizontalOverflow(page, route, viewport.name)
        await assertPortalIsClientSafe(page, route)
        await assertAccessible(page, route, viewport.name)
        console.log(
          reachedAuthGate(page, route)
            ? `ok ${viewport.name} auth-gate ${route}`
            : `ok ${viewport.name} ${route}`,
        )
      } catch (error) {
        failures.push(
          `${viewport.name} ${route}: ${error instanceof Error ? error.message : String(error)}`,
        )
      } finally {
        await context.close()
      }
    }
  }

  await runInteractionChecks(browser, failures)

  await browser.close()

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
