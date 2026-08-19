import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { organization } from 'better-auth/plugins'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import * as schema from '@/server/db/schema'

const googleId = env.GOOGLE_CLIENT_ID
const googleSecret = env.GOOGLE_CLIENT_SECRET

/** Only advertised in the UI when credentials actually exist — see `socialProviders`. */
export const GOOGLE_ENABLED = Boolean(googleId && googleSecret)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 10,
  },
  ...(GOOGLE_ENABLED
    ? {
        socialProviders: {
          google: { clientId: googleId as string, clientSecret: googleSecret as string },
        },
      }
    : {}),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [organization(), nextCookies()],
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL],
})

export type Session = typeof auth.$Infer.Session
