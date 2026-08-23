import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().startsWith('postgresql'),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_WEBHOOK_SECRET: z.string().min(1).optional(),
    OPENAI_POST_CALL_MODEL: z.string().min(1).optional(),
    // Accept either a raw 32-byte key or a deployment passphrase. The
    // protected-data boundary derives the latter into an isolated 256-bit key.
    DATA_ENCRYPTION_KEY: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_WEBHOOK_SECRET: process.env.OPENAI_WEBHOOK_SECRET,
    OPENAI_POST_CALL_MODEL: process.env.OPENAI_POST_CALL_MODEL,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
