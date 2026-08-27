'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authorizeClientWorkspace } from '@/server/auth/access'
import { db } from '@/server/db'
import { auditLog, customer, workspace } from '@/server/db/schema'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

async function audit(input: {
  workspaceId: string
  actorId: string
  action: string
  resourceId: string
  note: string
}) {
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    resourceType: 'customer',
    resourceId: input.resourceId,
    metadata: { note: input.note },
    createdAt: new Date(),
  })
}

/** The feature itself has to be on — `crm.manage` alone does not imply it is. */
async function requireCrmEnabled(workspaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ crmEnabled: workspace.crmEnabled })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1)
  return row?.crmEnabled === true
}

const customerSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'رقم الجوال غير صحيح'),
  email: z.string().trim().email('البريد غير صحيح').max(254).optional().or(z.literal('')),
  status: z.enum(['lead', 'active', 'inactive']),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export async function createCustomer(input: z.input<typeof customerSchema>): Promise<ActionResult> {
  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'تحقق من البيانات.' }
  }
  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'crm.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية إضافة جهات اتصال.' }
  if (!(await requireCrmEnabled(parsed.data.workspaceId))) {
    return { ok: false, error: 'ميزة إدارة العملاء غير مفعّلة على باقتك.' }
  }

  const phone = parsed.data.phone.trim()
  const [existing] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.workspaceId, parsed.data.workspaceId), eq(customer.phone, phone)))
    .limit(1)
  if (existing) return { ok: false, error: 'يوجد جهة اتصال بهذا الرقم بالفعل.' }

  const now = new Date()
  const customerId = id('cust')
  await db.insert(customer).values({
    id: customerId,
    workspaceId: parsed.data.workspaceId,
    phone,
    name: parsed.data.name || null,
    email: parsed.data.email || null,
    status: parsed.data.status,
    tags: parsed.data.tags ?? [],
    notes: parsed.data.notes || null,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  })

  await audit({
    workspaceId: parsed.data.workspaceId,
    actorId: access.email,
    action: 'crm.customer_created',
    resourceId: customerId,
    note: parsed.data.name ? `إضافة ${parsed.data.name}` : `إضافة جهة اتصال ${phone}`,
  })

  revalidatePath('/portal/customers')
  return { ok: true, message: 'أُضيفت جهة الاتصال.' }
}

const updateSchema = customerSchema.extend({ id: z.string().min(1) })

export async function updateCustomer(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'تحقق من البيانات.' }
  }
  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'crm.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية تعديل جهات الاتصال.' }
  if (!(await requireCrmEnabled(parsed.data.workspaceId))) {
    return { ok: false, error: 'ميزة إدارة العملاء غير مفعّلة على باقتك.' }
  }

  const [row] = await db
    .select({ id: customer.id, workspaceId: customer.workspaceId })
    .from(customer)
    .where(eq(customer.id, parsed.data.id))
    .limit(1)
  if (!row || row.workspaceId !== parsed.data.workspaceId) {
    return { ok: false, error: 'جهة الاتصال غير موجودة.' }
  }

  const phone = parsed.data.phone.trim()
  const [conflict] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.workspaceId, parsed.data.workspaceId), eq(customer.phone, phone)))
    .limit(1)
  if (conflict && conflict.id !== row.id) {
    return { ok: false, error: 'رقم الجوال مستخدم بالفعل من جهة اتصال أخرى.' }
  }

  await db
    .update(customer)
    .set({
      phone,
      name: parsed.data.name || null,
      email: parsed.data.email || null,
      status: parsed.data.status,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(customer.id, row.id))

  await audit({
    workspaceId: parsed.data.workspaceId,
    actorId: access.email,
    action: 'crm.customer_updated',
    resourceId: row.id,
    note: parsed.data.name ? `تعديل ${parsed.data.name}` : `تعديل جهة اتصال ${phone}`,
  })

  revalidatePath('/portal/customers')
  return { ok: true, message: 'حُفظت التعديلات.' }
}

const deleteSchema = z.object({ id: z.string().min(1), workspaceId: z.string().min(1) })

export async function deleteCustomer(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }
  const access = await authorizeClientWorkspace(parsed.data.workspaceId, 'crm.manage')
  if (!access) return { ok: false, error: 'ليس لديك صلاحية حذف جهات الاتصال.' }
  if (!(await requireCrmEnabled(parsed.data.workspaceId))) {
    return { ok: false, error: 'ميزة إدارة العملاء غير مفعّلة على باقتك.' }
  }

  const [row] = await db
    .select({ id: customer.id, workspaceId: customer.workspaceId, name: customer.name })
    .from(customer)
    .where(eq(customer.id, parsed.data.id))
    .limit(1)
  if (!row || row.workspaceId !== parsed.data.workspaceId) {
    return { ok: false, error: 'جهة الاتصال غير موجودة.' }
  }

  await db.delete(customer).where(eq(customer.id, row.id))

  await audit({
    workspaceId: parsed.data.workspaceId,
    actorId: access.email,
    action: 'crm.customer_deleted',
    resourceId: row.id,
    note: row.name ? `حذف ${row.name}` : 'حذف جهة اتصال',
  })

  revalidatePath('/portal/customers')
  return { ok: true, message: 'حُذفت جهة الاتصال.' }
}
