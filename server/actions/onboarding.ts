'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  flow,
  industryTemplate,
  integrationConnection,
  knowledgeItem,
  organization,
  phoneNumber,
  workspace,
} from '@/server/db/schema'

/**
 * Provisions a new client workspace from the onboarding wizard — Bible §30.
 *
 * This writes the same records Ops would create by hand: workspace, structured
 * knowledge, an agent with a draft v1 built from the industry pack, the pack's
 * flows, placeholder integration connections, and the phone number if supplied.
 * Nothing here is cosmetic; the console reads exactly these rows afterwards.
 */

const serviceSchema = z.object({
  title: z.string().trim().min(2, 'اسم الخدمة قصير جدًا').max(120),
  price: z.string().trim().max(60).optional(),
})

const schema = z.object({
  name: z.string().trim().min(2, 'اسم الشركة مطلوب').max(160),
  city: z.string().trim().min(2, 'المدينة مطلوبة').max(80),
  timezone: z.string().trim().min(3).max(60),
  pack: z.enum(['medical', 'realestate', 'auto', 'reception']),
  agentName: z.string().trim().min(2, 'اسم الموظف الصوتي مطلوب').max(60),
  services: z.array(serviceSchema).min(1, 'أضف خدمة واحدة على الأقل').max(30),
  branches: z.array(z.string().trim().min(2).max(120)).min(1, 'أضف فرعًا واحدًا على الأقل').max(30),
  hoursWeekday: z.string().trim().min(3).max(40),
  hoursWeekend: z.string().trim().max(40).optional(),
  transferTo: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, 'رقم التحويل غير صحيح'),
  did: z.string().trim().max(20).optional(),
})

export type OnboardingInput = z.input<typeof schema>

export type OnboardingResult =
  | { ok: true; workspaceSlug: string; workspaceName: string; agentName: string }
  | { ok: false; error: string; field?: string }

const ORG_ID = 'org_mujawib'

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

/** Latin slug when possible; Arabic names fall back to a stable random suffix. */
function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  return base.length >= 3 ? base : `client-${randomUUID().slice(0, 6)}`
}

export async function provisionWorkspace(input: OnboardingInput): Promise<OnboardingResult> {
  const access = await authorizeOperator('client.manage')
  if (!access) return { ok: false, error: 'لا تملك صلاحية إضافة عميل.' }
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      error: first?.message ?? 'تحقق من البيانات المدخلة.',
      ...(first?.path[0] ? { field: String(first.path[0]) } : {}),
    }
  }

  const data = parsed.data

  if (data.did && !/^\+?[0-9\s-]{8,20}$/.test(data.did)) {
    return { ok: false, error: 'رقم الاستقبال غير صحيح', field: 'did' }
  }

  // The operator organisation must exist before a workspace can hang off it.
  const [org] = await db.select().from(organization).where(eq(organization.id, ORG_ID)).limit(1)
  if (!org) {
    await db.insert(organization).values({
      id: ORG_ID,
      name: 'MUJAWIB Operations',
      slug: 'mujawib',
      createdAt: new Date(),
    })
  }

  const [template] = await db
    .select()
    .from(industryTemplate)
    .where(eq(industryTemplate.packKey, data.pack))
    .limit(1)

  if (!template) {
    return { ok: false, error: 'قالب القطاع غير متاح. تواصل مع فريق التشغيل.' }
  }

  let slug = slugify(data.name)
  const [clash] = await db.select().from(workspace).where(eq(workspace.slug, slug)).limit(1)
  if (clash) slug = `${slug}-${randomUUID().slice(0, 4)}`

  const workspaceId = id('ws')
  const agentId = id('agent')
  const versionId = id('av')
  const now = new Date()

  const packFlows = ((template.defaultFlows as string[]) ?? []).filter(Boolean)
  const packIntegrations = ((template.defaultIntegrations as string[]) ?? []).filter(Boolean)

  await db.insert(workspace).values({
    id: workspaceId,
    organizationId: ORG_ID,
    name: data.name,
    slug,
    type: 'client',
    status: 'setup',
    industryPack: data.pack,
    timezone: data.timezone,
    locale: 'ar-SA',
    businessInfo: {
      city: data.city,
      hours: { sun_thu: data.hoursWeekday, sat: data.hoursWeekend || 'مغلق', fri: 'مغلق' },
      branches: data.branches,
      transferTo: data.transferTo,
    },
    retentionPolicy: { calls: '180d', recordings: '30d', transcripts: '180d' },
    createdAt: now,
    updatedAt: now,
  })

  // Structured knowledge — Bible §12: prices and hours never rely on retrieval.
  await db.insert(knowledgeItem).values([
    ...data.services.map((s) => ({
      id: id('kn'),
      workspaceId,
      category: 'service',
      title: s.title,
      content: { price: s.price || 'حسب الحالة' } as Record<string, unknown>,
      source: 'onboarding',
      createdAt: now,
      updatedAt: now,
    })),
    ...data.branches.map((b) => ({
      id: id('kn'),
      workspaceId,
      category: 'branch',
      title: b,
      content: { city: data.city, hours: data.hoursWeekday } as Record<string, unknown>,
      source: 'onboarding',
      createdAt: now,
      updatedAt: now,
    })),
  ])

  await db.insert(agent).values({
    id: agentId,
    workspaceId,
    name: data.agentName,
    templateId: template.id,
    liveVersionId: null,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(agentVersion).values({
    id: versionId,
    agentId,
    versionNumber: 1,
    status: 'draft',
    identity: {
      role: `موظف استقبال صوتي لدى ${data.name}`,
      goals: ['الإجابة على الاستفسارات', 'إنجاز الحجز', 'التحويل الآمن عند الحاجة'],
      restricted: ['لا يؤكد سعرًا غير موجود في المعرفة'],
    },
    businessRules: {
      hours: data.hoursWeekday,
      weekend: data.hoursWeekend || 'مغلق',
      transferTo: data.transferTo,
    },
    flows: packFlows,
    toolBindings: packIntegrations,
    routing: { afterHours: 'callback', escalation: data.transferTo },
    readinessScore: 0,
    // Provisioning is not publishing — Bible §23 keeps the gate closed.
    blockers: ['اختبار الصوت لم يُنفّذ', 'مسار الهاتف لم يُوثَّق'],
    createdAt: now,
    updatedAt: now,
  })

  if (packFlows.length > 0) {
    await db.insert(flow).values(
      packFlows.map((name, i) => ({
        id: id('flow'),
        agentVersionId: versionId,
        name,
        goal: `إنجاز ${name} بدون تدخل بشري`,
        requiredFields: name.includes('حجز')
          ? ['الخدمة', 'التاريخ والوقت', 'الاسم', 'رقم الجوال']
          : ['الموضوع'],
        actions: name.includes('حجز') ? ['check_availability', 'create_booking'] : ['answer'],
        fallback: { onFailure: 'callback_or_transfer' },
        sortOrder: i,
        createdAt: now,
      })),
    )
  }

  if (packIntegrations.length > 0) {
    await db.insert(integrationConnection).values(
      packIntegrations.map((provider) => ({
        id: id('int'),
        workspaceId,
        provider,
        label: provider,
        health: 'disconnected' as const,
        config: { scope: 'workspace' },
        createdAt: now,
        updatedAt: now,
      })),
    )
  }

  if (data.did) {
    await db.insert(phoneNumber).values({
      id: id('phone'),
      workspaceId,
      e164: data.did.replaceAll(' ', ''),
      label: `الرقم الرئيسي — ${data.city}`,
      agentId,
      mode: 'all_calls',
      transferDestination: data.transferTo.replaceAll(' ', ''),
      sipStatus: 'pending',
      routingRules: { afterHours: 'callback' },
      createdAt: now,
      updatedAt: now,
    })
  }

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId,
    actorId: 'onboarding',
    action: 'workspace.provision',
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: { note: `تهيئة ${data.name} من قالب ${template.name}` },
    createdAt: now,
  })

  return { ok: true, workspaceSlug: slug, workspaceName: data.name, agentName: data.agentName }
}
