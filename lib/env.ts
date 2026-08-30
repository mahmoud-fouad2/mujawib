import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().startsWith('postgresql'),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_WEBHOOK_SECRET: z.string().min(1).optional(),
    OPENAI_REALTIME_MODEL: z.string().min(1).optional(),
    OPENAI_POST_CALL_MODEL: z.string().min(1).optional(),
    RECORDING_STORAGE_ENABLED: z.enum(['true', 'false']).default('false'),
    RECORDING_STORAGE_ENDPOINT: z.string().url().optional(),
    RECORDING_STORAGE_REGION: z.string().min(1).default('auto'),
    RECORDING_STORAGE_BUCKET: z.string().min(1).optional(),
    RECORDING_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
    RECORDING_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    RECORDING_MAX_SECONDS: z.coerce.number().int().min(60).max(7_200).default(3_600),
    // Backward-compatible Cloudflare R2 names. R2_PUBLIC_BASE_URL is
    // intentionally not consumed: recordings are never served from a public URL.
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    // Accept either a raw 32-byte key or a deployment passphrase. The
    // protected-data boundary derives the latter into an isolated 256-bit key.
    DATA_ENCRYPTION_KEY: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).optional(),
    // Bot protection for the public contact form (server/actions/contact.ts).
    // Both optional and independent of each other in validation — the form
    // itself only attempts verification when both happen to be set.
    RECAPTCHA_SITE_KEY: z.string().min(1).optional(),
    RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),
    // Read directly from process.env in instrumentation.ts/server/voice/log.ts/
    // server/jobs/worker.ts rather than from this validated `env` — those are
    // the SDK's own boot path and a hot logging path, and neither should gain
    // a dependency on this module's import graph. Declared here anyway so it
    // is validated, documented, and shows up next to every other optional
    // integration rather than being an env var nothing else in the codebase
    // knows about.
    SENTRY_DSN: z.string().url().optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_WEBHOOK_SECRET: process.env.OPENAI_WEBHOOK_SECRET,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
    OPENAI_POST_CALL_MODEL: process.env.OPENAI_POST_CALL_MODEL,
    RECORDING_STORAGE_ENABLED: process.env.RECORDING_STORAGE_ENABLED,
    RECORDING_STORAGE_ENDPOINT: process.env.RECORDING_STORAGE_ENDPOINT,
    RECORDING_STORAGE_REGION: process.env.RECORDING_STORAGE_REGION,
    RECORDING_STORAGE_BUCKET: process.env.RECORDING_STORAGE_BUCKET,
    RECORDING_STORAGE_ACCESS_KEY_ID: process.env.RECORDING_STORAGE_ACCESS_KEY_ID,
    RECORDING_STORAGE_SECRET_ACCESS_KEY: process.env.RECORDING_STORAGE_SECRET_ACCESS_KEY,
    RECORDING_MAX_SECONDS: process.env.RECORDING_MAX_SECONDS,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})

// The BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL sanity check lives in
// instrumentation.ts, not here. `next build` always runs with
// NODE_ENV=production regardless of .env.local's dev-appropriate localhost
// values, and this module loads during that build — a check gated on
// NODE_ENV alone would fail every local production build, not just a real
// misconfigured deploy. instrumentation.ts's register() only runs when a
// server actually starts serving traffic, which is the boundary that matters.
