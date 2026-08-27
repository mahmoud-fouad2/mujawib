'use server'

import { createHash, randomUUID } from 'node:crypto'
import { and, eq, gte } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { salesInquiry } from '@/server/db/schema'
import { notifyOperators, tryNotify } from '@/server/notifications/service'

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  need: z.string().trim().max(1200).default(''),
  monthlyCalls: z.enum(['under_500', '500_2000', '2000_10000', 'over_10000', 'unknown']),
  locale: z.enum(['ar', 'en']),
  consent: z.boolean().refine((value) => value, 'Consent is required'),
  website: z.string().max(0).optional(),
})

export type ContactResult = { ok: true; message: string } | { ok: false; error: string }

export async function createSalesInquiry(input: z.input<typeof schema>): Promise<ContactResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error:
        input.locale === 'en'
          ? 'Please check the required fields.'
          : 'تحقق من البيانات المطلوبة قبل الإرسال.',
    }
  }

  // Honeypot submissions receive a neutral success and never reach Operations.
  if (parsed.data.website) {
    return {
      ok: true,
      message: parsed.data.locale === 'en' ? 'Request received.' : 'وصل طلبك.',
    }
  }

  const requestHeaders = await headers()
  const clientAddress =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    requestHeaders.get('x-real-ip') ??
    'unknown'
  const fingerprint = createHash('sha256')
    .update(`${env.BETTER_AUTH_SECRET}:${clientAddress}:${parsed.data.email}`)
    .digest('hex')
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000)
  const [recent] = await db
    .select({ id: salesInquiry.id })
    .from(salesInquiry)
    .where(
      and(
        eq(salesInquiry.requestFingerprint, fingerprint),
        gte(salesInquiry.createdAt, recentCutoff),
      ),
    )
    .limit(1)

  if (recent) {
    return {
      ok: true,
      message:
        parsed.data.locale === 'en'
          ? 'Your request is already with our team.'
          : 'طلبك موجود بالفعل لدى الفريق.',
    }
  }

  const id = `inquiry_${randomUUID().replaceAll('-', '').slice(0, 20)}`
  const now = new Date()
  await db.insert(salesInquiry).values({
    id,
    name: parsed.data.name,
    company: parsed.data.company,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    need:
      parsed.data.need.length > 0
        ? parsed.data.need
        : parsed.data.locale === 'ar'
          ? 'طلب استشارة عام'
          : 'General inquiry',
    monthlyCalls: parsed.data.monthlyCalls,
    locale: parsed.data.locale,
    source: 'website',
    status: 'new',
    requestFingerprint: fingerprint,
    consentAt: now,
    createdAt: now,
    updatedAt: now,
  })

  await tryNotify(() =>
    notifyOperators({
      roles: ['owner', 'ops'],
      severity: 'info',
      category: 'system',
      title: 'طلب عرض جديد',
      message: `${parsed.data.company} — ${parsed.data.name}`,
      href: '/console/inquiries',
      sourceType: 'sales_inquiry',
      sourceId: id,
      dedupeKey: `sales-inquiry:${id}`,
    }),
  )

  return {
    ok: true,
    message:
      parsed.data.locale === 'en'
        ? 'Received. We will contact you within one business day.'
        : 'وصل طلبك. سنتواصل معك خلال يوم عمل واحد.',
  }
}
