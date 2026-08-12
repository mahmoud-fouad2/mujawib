import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/server/db'
import * as schema from '@/server/db/schema'

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
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: async (user) => {
        // Operator staff only — gate via invite in production
        return user.email?.endsWith('@mujawib.com') ?? false
      },
    }),
    nextCookies(),
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL!, process.env.NEXT_PUBLIC_APP_URL!].filter(
    Boolean,
  ),
})

export type Session = typeof auth.$Infer.Session
