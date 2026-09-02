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
    // Read directly from process.env by the modules that own them (they run on
    // the call's critical path or during shutdown, and must not pull this
    // module's import graph in). Declared here so they are validated,
    // documented, and visible next to everything else that configures a deploy.
    //
    // How many calls one process will carry before refusing new ones. Refusal
    // is a real outcome: an unanswered invite falls through to the client's
    // human line, which beats being answered by an overloaded process.
    ACTIVE_REALTIME_CALL_LIMIT: z.coerce.number().int().min(1).max(500).optional(),
    // How long shutdown waits for calls to end before handing them over. Must
    // stay comfortably under the platform's own kill grace period.
    SHUTDOWN_DRAIN_TIMEOUT_MS: z.coerce.number().int().min(0).max(120_000).optional(),
    // Size of the pool reserved for the voice runtime. Deliberately small —
    // the point is isolation from page traffic, not headroom.
    DATABASE_REALTIME_POOL_MAX: z.coerce.number().int().min(1).max(20).optional(),
    // The container memory limit, which Node cannot discover for itself: V8
    // sizes its heap from the host, not the cgroup. Pressure is measured
    // against this, and calls are refused before it is reached.
    MEMORY_LIMIT_MB: z.coerce.number().int().min(128).max(16_384).optional(),
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

    // ── outbound calling ────────────────────────────────────────────────
    //
    // Read directly from process.env in server/outbound/*, which run on the
    // dispatcher's path and must not pull this module's import graph in.
    // Declared here so a deploy has one place that lists what outbound needs,
    // and so a malformed value fails at boot rather than at the first dial.
    //
    // Absent, `outboundDialerStatus()` reports not-ready and no code path in
    // this product can ring a phone. That is the default and it is deliberate.
    TWILIO_ACCOUNT_SID: z
      .string()
      .regex(/^AC[0-9a-fA-F]{32}$/, 'TWILIO_ACCOUNT_SID must be an AC… account SID')
      .optional(),
    TWILIO_AUTH_TOKEN: z.string().min(16).optional(),
    /** The number verification codes are sent from. Without it, no SMS. */
    TWILIO_SMS_FROM: z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/, 'TWILIO_SMS_FROM must be E.164')
      .optional(),
    /** OpenAI project whose SIP endpoint every call — in or out — lands on. */
    OPENAI_PROJECT_ID: z.string().min(1).optional(),
    /** Overrides the SIP URI built from OPENAI_PROJECT_ID. Rarely needed. */
    OPENAI_SIP_URI: z.string().min(1).optional(),
    /**
     * Ceiling on automatic demo calls per day across the whole platform.
     *
     * The last line of defence: if verification, rate limiting and the
     * blocklist all fail at once, this is what stops the bill. Deliberately
     * small by default.
     */
    DEMO_DAILY_CALL_CAP: z.coerce.number().int().min(0).max(2_000).default(50),
    /**
     * Which assistant answers the demo, and which number it calls from.
     *
     * Both unset is the safe default: a verified request then waits for an
     * operator to pick, exactly as it does today. Setting them is the
     * deliberate act that turns the demo call automatic.
     */
    DEMO_AGENT_VERSION_ID: z.string().min(1).optional(),
    DEMO_FROM_NUMBER_ID: z.string().min(1).optional(),

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
    ACTIVE_REALTIME_CALL_LIMIT: process.env.ACTIVE_REALTIME_CALL_LIMIT,
    SHUTDOWN_DRAIN_TIMEOUT_MS: process.env.SHUTDOWN_DRAIN_TIMEOUT_MS,
    DATABASE_REALTIME_POOL_MAX: process.env.DATABASE_REALTIME_POOL_MAX,
    MEMORY_LIMIT_MB: process.env.MEMORY_LIMIT_MB,
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
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
    OPENAI_PROJECT_ID: process.env.OPENAI_PROJECT_ID,
    OPENAI_SIP_URI: process.env.OPENAI_SIP_URI,
    DEMO_DAILY_CALL_CAP: process.env.DEMO_DAILY_CALL_CAP,
    DEMO_AGENT_VERSION_ID: process.env.DEMO_AGENT_VERSION_ID,
    DEMO_FROM_NUMBER_ID: process.env.DEMO_FROM_NUMBER_ID,
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
