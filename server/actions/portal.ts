'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { auditLog, changeRequest, knowledgeItem, workspace } from '@/server/db/schema'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

async function actor() {
  const user = await getCurrentUser()
  return user?.email ?? 'client'
}

/* ─── Change requests ────────────────────────────────────────────────────── */

const requestSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(['business_info', 'new_service', 'behavior', 'pronunciation', 'integration']),
  title: z.string().trim().min(4, 'اكتب عنوانًا واضحًا للطلب').max(160),
  description: z.string().trim().max(1000).optional(),
})

/** Bible §21: the client files a request and follows it like an issue. */
export async function createChangeRequest(
  input: z.input<typeof requestSchema>,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'تحقق من البيانات.' }
  }

  const now = new Date()
  const requester = await actor()

  await db.insert(changeRequest).values({
    id: id('cr'),
    workspaceId: parsed.data.workspaceId,
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: 'requested',
    requestedById: requester,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: parsed.data.workspaceId,
    actorId: requester,
    action: 'change_request.create',
    resourceType: 'change_request',
    metadata: { note: parsed.data.title },
    createdAt: now,
  })

  revalidatePath('/portal/requests')
  revalidatePath('/portal')
  return { ok: true, message: 'سُجّل طلبك، وسيصلك تحديث عند بدء المراجعة.' }
}

export async function cancelChangeRequest(requestId: string): Promise<ActionResult> {
  const [row] = await db
    .select()
    .from(changeRequest)
    .where(eq(changeRequest.id, requestId))
    .limit(1)
  if (!row) return { ok: false, error: 'الطلب غير موجود.' }
  if (row.status === 'live') return { ok: false, error: 'الطلب نُفِّذ بالفعل ولا يمكن سحبه.' }

  await db
    .update(changeRequest)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(changeRequest.id, requestId))

  revalidatePath('/portal/requests')
  return { ok: true, message: 'سُحب الطلب.' }
}

/* ─── Business info the client is allowed to change ──────────────────────── */

const hoursSchema = z.object({
  workspaceId: z.string().min(1),
  hoursWeekday: z.string().trim().min(3).max(40),
  hoursWeekend: z.string().trim().max(40).optional(),
})

/**
 * Opening hours are a safe field — Bible §21 lets the client publish these
 * directly. Anything that changes agent behaviour goes through a request.
 */
export async function updateOpeningHours(
  input: z.input<typeof hoursSchema>,
): Promise<ActionResult> {
  const parsed = hoursSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'تحقق من صيغة ساعات العمل.' }

  const [row] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!row) return { ok: false, error: 'مساحة العمل غير موجودة.' }

  const info = (row.businessInfo ?? {}) as Record<string, unknown>
  const hours = (info.hours ?? {}) as Record<string, string>

  await db
    .update(workspace)
    .set({
      businessInfo: {
        ...info,
        hours: {
          ...hours,
          sun_thu: parsed.data.hoursWeekday,
          sat: parsed.data.hoursWeekend || 'مغلق',
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, parsed.data.workspaceId))

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: row.id,
    actorId: await actor(),
    action: 'client.hours_update',
    resourceType: 'workspace',
    resourceId: row.id,
    metadata: { note: `تحديث ساعات العمل إلى ${parsed.data.hoursWeekday}` },
    createdAt: new Date(),
  })

  revalidatePath('/portal/business-info')
  return { ok: true, message: 'حُدّثت ساعات العمل، ويعمل بها المُجاوِب فورًا.' }
}

/* ─── Services the client maintains ──────────────────────────────────────── */

const serviceSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(2, 'اسم الخدمة مطلوب').max(120),
  price: z.string().trim().max(60).optional(),
  duration: z.string().trim().max(60).optional(),
})

export async function addService(input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'تحقق من البيانات.' }
  }

  const now = new Date()
  await db.insert(knowledgeItem).values({
    id: id('kn'),
    workspaceId: parsed.data.workspaceId,
    category: 'service',
    title: parsed.data.title,
    content: {
      price: parsed.data.price || 'حسب الحالة',
      duration: parsed.data.duration || '—',
    },
    source: 'client',
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/portal/business-info')
  return { ok: true, message: `أُضيفت «${parsed.data.title}» وأصبح المُجاوِب يجيب عنها.` }
}

export async function removeService(itemId: string): Promise<ActionResult> {
  const [row] = await db.select().from(knowledgeItem).where(eq(knowledgeItem.id, itemId)).limit(1)
  if (!row) return { ok: false, error: 'العنصر غير موجود.' }

  await db.delete(knowledgeItem).where(eq(knowledgeItem.id, itemId))

  revalidatePath('/portal/business-info')
  return { ok: true, message: `حُذفت «${row.title}».` }
}
