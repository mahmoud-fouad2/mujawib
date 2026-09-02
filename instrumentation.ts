/**
 * Sentry is imported only when it is actually going to be used.
 *
 * `import * as Sentry from '@sentry/nextjs'` at module scope cost a measured
 * 34MB of RSS on import — it pulls in @sentry/node and its OpenTelemetry
 * auto-instrumentation — and it was paid unconditionally, including on a
 * deployment with no DSN configured, where every one of those bytes belongs to
 * a no-op. On a 512MB container that is seven percent of the whole budget.
 * With a DSN set the cost is real and worth it; without one it is not.
 */
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

    // Termination handling before anything that can hold a call. Next.js
    // installs its own SIGTERM handler that exits as soon as the HTTP server
    // closes, which is why `NEXT_MANUAL_SIG_HANDLE` has to be set for this to
    // do anything — `installShutdownHandlers` says so in the log if it is not.
    // Starts the event-loop delay histogram before anything else can block it.
    const { startVitals } = await import('./server/runtime/vitals')
    startVitals()

    const { installShutdownHandlers } = await import('./server/runtime/lifecycle')
    const { registerSidebandDrainHook } = await import('./server/voice/sideband')
    registerSidebandDrainHook()
    installShutdownHandlers()

    const { startBackgroundWorker } = await import('./server/jobs/worker')
    startBackgroundWorker()

    // Seeds the launch articles if they are absent. Detached and never fatal:
    // this deployment has no shell, so a seed that needs a terminal would
    // never run — but a content seed must not delay or fail a boot either.
    const { ensureSeedArticles } = await import('./server/content/ensure-articles')
    void ensureSeedArticles()

    const { checkSecretDrift } = await import('./server/security/secret-drift')
    void checkSecretDrift()
  }

  // Optional, like every other third-party integration in this app
  // (RESEND_API_KEY, GOOGLE_CLIENT_ID). Unset now means the SDK is never
  // loaded at all, rather than loaded and told to stay quiet.
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Request/response bodies and headers can carry a caller's phone number
      // or a session cookie; this app already has its own masking discipline
      // (server/voice/log.ts) for exactly that data, so Sentry is not asked
      // to collect it independently.
      sendDefaultPii: false,
      // Lowered from 0.2. Tracing is the expensive half of the SDK — it is
      // what pulls in the OpenTelemetry auto-instrumentation and keeps spans
      // in memory — and on a 512MB container that budget is better spent on
      // carrying calls. Errors, which are what this deployment actually reads,
      // are unaffected by this rate.
      tracesSampleRate: 0.05,
    })
  }
}

/**
 * Next.js's App Router hook for an error that surfaces during rendering or a
 * route handler, outside any component's own try/catch.
 *
 * Forwards to Sentry only when a DSN is configured, so a deployment without
 * one never pays the SDK's import cost on this path either. Next calls this
 * for every unhandled request error, so it must not throw: a failure to report
 * an error must not itself become one.
 */
export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import('@sentry/nextjs')
    await Sentry.captureRequestError(...args)
  } catch {
    // Reporting is best effort; the request has already failed on its own.
  }
}
