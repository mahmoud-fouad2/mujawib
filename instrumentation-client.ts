import * as Sentry from '@sentry/nextjs'

// Loaded automatically by Next.js (15.3+) for every client bundle — no import
// or wiring needed elsewhere. `NEXT_PUBLIC_SENTRY_DSN` mirrors the server-side
// `SENTRY_DSN`: unset means this stays a no-op, same as every other optional
// integration in this app.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
  })
}
