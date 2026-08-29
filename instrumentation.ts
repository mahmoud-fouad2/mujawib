import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Runs once, only when a server process actually starts serving traffic —
    // unlike lib/env.ts, which also loads during `next build`, where
    // NODE_ENV is always 'production' regardless of .env.local's
    // dev-appropriate localhost URLs. This is the right boundary for a check
    // that must fire against a real deploy but never against a local build.
    const { env } = await import('./lib/env')
    if (env.NODE_ENV === 'production') {
      const { appUrlProblem } = await import('./lib/app-url')
      const problem = appUrlProblem(env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL)
      // Refuses to boot rather than serving a health check that passes while
      // login sends every browser to a URL that does not exist outside the
      // container — see lib/app-url.ts for the incident this is.
      if (problem) throw new Error(problem)

      const { recordingStorageProblem } = await import('./server/storage/recordings')
      const storageProblem = recordingStorageProblem()
      if (storageProblem) throw new Error(storageProblem)
    }

    const { startBackgroundWorker } = await import('./server/jobs/worker')
    startBackgroundWorker()

    const { checkSecretDrift } = await import('./server/security/secret-drift')
    void checkSecretDrift()
  }

  // Optional, like every other third-party integration in this app
  // (RESEND_API_KEY, GOOGLE_CLIENT_ID): unset means Sentry.init runs with no
  // DSN, which the SDK treats as "stay a no-op" rather than an error — so a
  // deployment with nothing configured behaves exactly as it did before this
  // file existed. Importing the package itself is always safe; it is calling
  // .init() with a real DSN that starts anything network-facing.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Request/response bodies and headers can carry a caller's phone number
      // or a session cookie; this app already has its own masking discipline
      // (server/voice/log.ts) for exactly that data, so Sentry is not asked
      // to collect it independently.
      sendDefaultPii: false,
      tracesSampleRate: 0.2,
    })
  }
}

/**
 * Next.js's App Router hook for an error that surfaces during rendering or a
 * route handler, outside any component's own try/catch. Sentry's own binding
 * for it — a no-op when SENTRY_DSN was never set above, so this is safe to
 * export unconditionally rather than behind the same `if`.
 */
export const onRequestError = Sentry.captureRequestError
