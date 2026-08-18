import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { organization } from 'better-auth/plugins'
import { db } from '@/server/db'
import * as schema from '@/server/db/schema'

const googleId = process.env.GOOGLE_CLIENT_ID
const googleSecret = process.env.GOOGLE_CLIENT_SECRET

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
  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
    (v): v is string => Boolean(v),
  ),
})

export type Session = typeof auth.$Infer.Session
