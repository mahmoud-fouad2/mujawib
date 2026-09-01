import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * These tests need three things Vitest deliberately does not have: a running
 * server, a real database, and a browser. That is the whole point — the unit
 * suite proves logic in isolation, and nothing in it can catch a page that
 * renders blank because a query changed shape, or a role that can reach a
 * screen it should not.
 *
 * `MUJAWIB_E2E_BASE_URL` points at an already-running instance. Nothing here
 * starts a server: a suite that boots its own would either race the dev
 * server a developer already has open, or silently test a stale build.
 */
const baseURL = process.env.MUJAWIB_E2E_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  // Sign-in flows write cookies and the console mutates shared rows, so the
  // suite runs serially against one database rather than fighting itself.
  workers: 1,
  fullyParallel: false,
  // A flaky end-to-end test is worse than none: it trains everyone to ignore
  // red. One retry catches a genuinely slow cold start; more would hide a bug.
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'public',
      testMatch: /public\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'operator',
      testMatch: /operator\..*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/operator.json' },
    },
    {
      name: 'client',
      testMatch: /client\..*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/client.json' },
    },
    {
      name: 'mobile',
      testMatch: /public\..*\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
})
