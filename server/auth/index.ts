import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { organization, twoFactor } from 'better-auth/plugins'
import { MANAGED_AUTH_POLICY } from '@/lib/auth-policy'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import * as schema from '@/server/db/schema'

const googleId = env.GOOGLE_CLIENT_ID
const googleSecret = env.GOOGLE_CLIENT_SECRET
const developmentOrigins =
  process.env.NODE_ENV === 'development' ? ['http://localhost:*', 'http://127.0.0.1:*'] : []

/** Only advertised in the UI when credentials actually exist — see `socialProviders`. */
export const GOOGLE_ENABLED = Boolean(googleId && googleSecret)

function cleanMailText(value: string): string {
  return Array.from(value, (character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .trim()
    .slice(0, 160)
}

async function sendPasswordResetEmail(input: {
  user: { name: string; email: string }
  url: string
}) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error('Password recovery email is not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.user.email],
      subject: 'استعادة كلمة مرور مُجاوِب',
      text: [
        `مرحبًا ${cleanMailText(input.user.name) || 'بك'}،`,
        '',
        'استخدم الرابط التالي لتعيين كلمة مرور جديدة. تنتهي صلاحيته خلال ساعة:',
        input.url,
        '',
        'إذا لم تطلب هذا التغيير، تجاهل الرسالة.',
      ].join('\n'),
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) throw new Error('Password recovery email could not be delivered')
}

export const auth = betterAuth({
  // Passed explicitly rather than left to Better Auth's own env-var-name
  // convention (it would find BETTER_AUTH_URL either way): every redirect
  // this issues — post-sign-in, post-2FA, every callback — resolves against
  // this value, so it should be readable by grep, not implied by a variable
  // name nothing in this file references. lib/env.ts refuses to boot in
  // production if it is ever a localhost URL.
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !MANAGED_AUTH_POLICY.publicEmailSignUp,
    requireEmailVerification: false,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: sendPasswordResetEmail,
  },
  ...(GOOGLE_ENABLED
    ? {
        socialProviders: {
          google: {
            clientId: googleId as string,
            clientSecret: googleSecret as string,
            disableImplicitSignUp: !MANAGED_AUTH_POLICY.publicSocialSignUp,
            disableSignUp: !MANAGED_AUTH_POLICY.publicSocialSignUp,
          },
        },
      }
    : {}),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip'],
    },
  },
  plugins: [
    organization(),
    /**
     * Pinned rather than left to the plugin defaults, because two of these
     * values are read at enrollment and again at every verification. A default
     * that shifts between those two moments silently invalidates every code an
     * already-enrolled authenticator produces, and the person signing in only
     * ever sees "wrong code".
     *
     * `accountLockout` is deliberately short. It exists to blunt online
     * guessing, not to strand an operator: at 15 minutes a locked account was
     * a support call, and the lock reads as a permanently wrong code because
     * the challenge screen cannot tell the two apart. Five minutes still costs
     * an attacker far more than it costs the person who fat-fingered a digit,
     * and the challenge screen now names the lock and counts it down.
     */
    twoFactor({
      issuer: 'MUJAWIB',
      totpOptions: { digits: 6, period: 30 },
      accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 300 },
    }),
    nextCookies(),
  ],
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL, ...developmentOrigins],
})
