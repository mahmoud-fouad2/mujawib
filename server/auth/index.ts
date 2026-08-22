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
  plugins: [organization(), twoFactor(), nextCookies()],
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL, ...developmentOrigins],
})
