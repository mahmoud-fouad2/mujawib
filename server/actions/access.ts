'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ROLE_LABEL, isClientRole, isOperatorRole } from '@/lib/access'
import { env } from '@/lib/env'
import {
  INVITATION_TTL_DAYS,
  isInvitationOpen,
  maskInvitationEmail,
  normalizeInvitationEmail,
  roleFitsWorkspace,
} from '@/lib/invitations'
import { auth } from '@/server/auth'
import { authorizeOperator } from '@/server/auth/access'
import {
  buildInvitationUrl,
  createInvitationToken,
  hashInvitationToken,
} from '@/server/auth/invitations'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  account,
  auditLog,
  user,
  workspace,
  workspaceAccess,
  workspaceInvitation,
} from '@/server/db/schema'

export type AccessActionResult = { ok: true; message: string } | { ok: false; error: string }
export type InvitationActionResult =
  | {
      ok: true
      message: string
      data: { inviteUrl: string; expiresAt: string }
    }
  | { ok: false; error: string }

export type InvitationAcceptanceResult =
  | { ok: true; message: string; redirectTo: '/console' | '/portal' }
  | { ok: false; error: string; reason?: 'auth' | 'email' | 'invalid' }

export type InvitationPreviewResult =
  | {
      ok: true
      invitation: {
        workspaceName: string
        workspaceType: 'operator' | 'client'
        roleLabel: string
        maskedEmail: string
        expiresAt: string
        accountExists: boolean
      }
    }
  | { ok: false; error: string }

const grantSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  workspaceId: z.string().min(1),
  role: z.string().min(1).max(40),
})

const invitationSchema = grantSchema
const tokenSchema = z.string().trim().min(32).max(256)
const invitedAccountSchema = z.object({
  token: tokenSchema,
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(normalizeInvitationEmail),
  password: z.string().min(10).max(128),
})

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export async function createWorkspaceInvitation(
  input: z.input<typeof invitationSchema>,
): Promise<InvitationActionResult> {
  const owner = await authorizeOperator('access.manage')
  if (!owner) return { ok: false, error: 'إدارة الدعوات متاحة لمالك المنصة فقط.' }

  const parsed = invitationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'تحقق من البريد والدور ومساحة العمل.' }

  const email = normalizeInvitationEmail(parsed.data.email)
  const [targetWorkspace] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!targetWorkspace) return { ok: false, error: 'مساحة العمل غير موجودة.' }
  if (!roleFitsWorkspace(parsed.data.role, targetWorkspace.type)) {
    return { ok: false, error: 'هذا الدور لا يناسب نوع مساحة العمل.' }
  }

  const [existingAccount] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  if (existingAccount) {
    const [existingAccess] = await db
      .select({ id: workspaceAccess.id })
      .from(workspaceAccess)
      .where(
        and(
          eq(workspaceAccess.userId, existingAccount.id),
          eq(workspaceAccess.workspaceId, targetWorkspace.id),
        ),
      )
      .limit(1)
    if (existingAccess) {
      return { ok: false, error: 'هذا الحساب مرتبط بالفعل بمساحة العمل المحددة.' }
    }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const token = createInvitationToken()
  const invitationId = id('invite')

  await db.batch([
    db
      .update(workspaceInvitation)
      .set({ status: 'revoked', updatedAt: now })
      .where(
        and(
          eq(workspaceInvitation.workspaceId, targetWorkspace.id),
          eq(workspaceInvitation.email, email),
          eq(workspaceInvitation.status, 'pending'),
        ),
      ),
    db.insert(workspaceInvitation).values({
      id: invitationId,
      workspaceId: targetWorkspace.id,
      email,
      role: parsed.data.role,
      tokenHash: token.hash,
      status: 'pending',
      invitedById: owner.userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: targetWorkspace.id,
      actorId: owner.email,
      action: 'access.invite',
      resourceType: 'workspace_invitation',
      resourceId: invitationId,
      metadata: { note: `${email} — ${parsed.data.role}` },
      createdAt: now,
    }),
  ])

  revalidatePath('/console/access')
  return {
    ok: true,
    message: `أُنشئت دعوة ${email}. يظهر الرابط مرة واحدة فقط.`,
    data: {
      inviteUrl: buildInvitationUrl(env.NEXT_PUBLIC_APP_URL, token.raw),
      expiresAt: expiresAt.toISOString(),
    },
  }
}

export async function revokeWorkspaceInvitation(invitationId: string): Promise<AccessActionResult> {
  const owner = await authorizeOperator('access.manage')
  if (!owner) return { ok: false, error: 'إدارة الدعوات متاحة لمالك المنصة فقط.' }

  const [row] = await db
    .select({
      id: workspaceInvitation.id,
      workspaceId: workspaceInvitation.workspaceId,
      email: workspaceInvitation.email,
      status: workspaceInvitation.status,
      workspaceName: workspace.name,
    })
    .from(workspaceInvitation)
    .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))
    .where(eq(workspaceInvitation.id, invitationId))
    .limit(1)
  if (row?.status !== 'pending') {
    return { ok: false, error: 'الدعوة غير موجودة أو لم تعد قابلة للإلغاء.' }
  }

  const now = new Date()
  await db.batch([
    db
      .update(workspaceInvitation)
      .set({ status: 'revoked', updatedAt: now })
      .where(and(eq(workspaceInvitation.id, row.id), eq(workspaceInvitation.status, 'pending'))),
    db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: row.workspaceId,
      actorId: owner.email,
      action: 'access.invitation_revoke',
      resourceType: 'workspace_invitation',
      resourceId: row.id,
      metadata: { note: row.email },
      createdAt: now,
    }),
  ])

  revalidatePath('/console/access')
  return { ok: true, message: `أُلغيت دعوة ${row.email} إلى ${row.workspaceName}.` }
}

export async function getInvitationPreview(tokenInput: string): Promise<InvitationPreviewResult> {
  const parsed = tokenSchema.safeParse(tokenInput)
  if (!parsed.success) return { ok: false, error: 'رابط الدعوة غير صالح.' }

  const [row] = await db
    .select({
      email: workspaceInvitation.email,
      role: workspaceInvitation.role,
      status: workspaceInvitation.status,
      expiresAt: workspaceInvitation.expiresAt,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    })
    .from(workspaceInvitation)
    .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))
    .where(eq(workspaceInvitation.tokenHash, hashInvitationToken(parsed.data)))
    .limit(1)

  if (!row || !isInvitationOpen(row.status, row.expiresAt)) {
    return { ok: false, error: 'انتهت صلاحية الدعوة أو استُخدمت من قبل.' }
  }
  if (!roleFitsWorkspace(row.role, row.workspaceType)) {
    return { ok: false, error: 'إعداد الدعوة غير صالح. اطلب دعوة جديدة.' }
  }

  const [existingAccount] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, row.email))
    .limit(1)

  return {
    ok: true,
    invitation: {
      workspaceName: row.workspaceName,
      workspaceType: row.workspaceType,
      roleLabel: ACCESS_ROLE_LABEL[row.role],
      maskedEmail: maskInvitationEmail(row.email),
      expiresAt: row.expiresAt.toISOString(),
      accountExists: Boolean(existingAccount),
    },
  }
}

/**
 * Creates an identity only when a live, email-bound invitation authorizes it.
 * Public Better Auth sign-up is disabled; this is the managed product's only
 * browser path for a new account.
 */
export async function createInvitedWorkspaceAccount(
  input: z.input<typeof invitedAccountSchema>,
): Promise<InvitationAcceptanceResult> {
  const parsed = invitedAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'تحقق من الاسم والبريد وكلمة المرور.', reason: 'invalid' }
  }

  const tokenHash = hashInvitationToken(parsed.data.token)
  const [row] = await db
    .select({
      id: workspaceInvitation.id,
      workspaceId: workspaceInvitation.workspaceId,
      email: workspaceInvitation.email,
      role: workspaceInvitation.role,
      status: workspaceInvitation.status,
      expiresAt: workspaceInvitation.expiresAt,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    })
    .from(workspaceInvitation)
    .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))
    .where(eq(workspaceInvitation.tokenHash, tokenHash))
    .limit(1)

  if (!row || !isInvitationOpen(row.status, row.expiresAt)) {
    return {
      ok: false,
      error: 'انتهت صلاحية الدعوة أو استُخدمت من قبل.',
      reason: 'invalid',
    }
  }
  if (parsed.data.email !== row.email) {
    return {
      ok: false,
      error: `استخدم البريد الذي أُرسلت إليه الدعوة: ${maskInvitationEmail(row.email)}.`,
      reason: 'email',
    }
  }
  if (!roleFitsWorkspace(row.role, row.workspaceType)) {
    return { ok: false, error: 'إعداد الدعوة غير صالح. اطلب دعوة جديدة.', reason: 'invalid' }
  }

  const [existingAccount] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, row.email))
    .limit(1)
  if (existingAccount) {
    return {
      ok: false,
      error: 'يوجد حساب بهذا البريد. اختر تسجيل الدخول بدلًا من إنشاء حساب.',
      reason: 'auth',
    }
  }

  const context = await auth.$context
  const passwordHash = await context.password.hash(parsed.data.password)
  const userId = id('usr')
  const now = new Date()

  try {
    await db.batch([
      db.insert(user).values({
        id: userId,
        name: parsed.data.name,
        email: row.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(account).values({
        id: id('acc'),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(workspaceAccess).values({
        id: id('access'),
        workspaceId: row.workspaceId,
        userId,
        role: row.role,
        createdAt: now,
        updatedAt: now,
      }),
      db
        .update(workspaceInvitation)
        .set({
          status: 'accepted',
          acceptedById: userId,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceInvitation.id, row.id),
            eq(workspaceInvitation.status, 'pending'),
            gt(workspaceInvitation.expiresAt, now),
          ),
        ),
      db.insert(auditLog).values({
        id: id('audit'),
        workspaceId: row.workspaceId,
        actorId: row.email,
        action: 'access.invited_account_create',
        resourceType: 'workspace_invitation',
        resourceId: row.id,
        metadata: { note: `${row.email} — ${row.role}` },
        createdAt: now,
      }),
    ])
  } catch {
    return {
      ok: false,
      error: 'تعذر إنشاء الحساب الآن. جرّب تسجيل الدخول إن سبق لك استخدام هذا البريد.',
      reason: 'invalid',
    }
  }

  revalidatePath('/console/access')
  return {
    ok: true,
    message: `اكتمل إنشاء حسابك وربطه بـ ${row.workspaceName}.`,
    redirectTo: row.workspaceType === 'operator' ? '/console' : '/portal',
  }
}

export async function acceptWorkspaceInvitation(
  tokenInput: string,
): Promise<InvitationAcceptanceResult> {
  const session = await getSession()
  if (!session) {
    return { ok: false, error: 'سجّل الدخول أو أنشئ حسابك أولًا.', reason: 'auth' }
  }

  const parsed = tokenSchema.safeParse(tokenInput)
  if (!parsed.success) return { ok: false, error: 'رابط الدعوة غير صالح.', reason: 'invalid' }

  const [row] = await db
    .select({
      id: workspaceInvitation.id,
      workspaceId: workspaceInvitation.workspaceId,
      email: workspaceInvitation.email,
      role: workspaceInvitation.role,
      status: workspaceInvitation.status,
      expiresAt: workspaceInvitation.expiresAt,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    })
    .from(workspaceInvitation)
    .innerJoin(workspace, eq(workspaceInvitation.workspaceId, workspace.id))
    .where(eq(workspaceInvitation.tokenHash, hashInvitationToken(parsed.data)))
    .limit(1)

  if (!row || !isInvitationOpen(row.status, row.expiresAt)) {
    return {
      ok: false,
      error: 'انتهت صلاحية الدعوة أو استُخدمت من قبل.',
      reason: 'invalid',
    }
  }
  if (normalizeInvitationEmail(session.user.email) !== row.email) {
    return {
      ok: false,
      error: `هذه الدعوة مخصصة لبريد ${maskInvitationEmail(row.email)}.`,
      reason: 'email',
    }
  }
  if (!roleFitsWorkspace(row.role, row.workspaceType)) {
    return { ok: false, error: 'إعداد الدعوة غير صالح. اطلب دعوة جديدة.', reason: 'invalid' }
  }

  const [existingAccess] = await db
    .select({ id: workspaceAccess.id })
    .from(workspaceAccess)
    .where(
      and(
        eq(workspaceAccess.userId, session.user.id),
        eq(workspaceAccess.workspaceId, row.workspaceId),
      ),
    )
    .limit(1)
  if (existingAccess) {
    return { ok: false, error: 'حسابك مرتبط بالفعل بمساحة العمل هذه.', reason: 'invalid' }
  }

  const now = new Date()
  await db.batch([
    db
      .update(workspaceInvitation)
      .set({
        status: 'accepted',
        acceptedById: session.user.id,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceInvitation.id, row.id),
          eq(workspaceInvitation.status, 'pending'),
          gt(workspaceInvitation.expiresAt, now),
        ),
      ),
    db
      .insert(workspaceAccess)
      .values({
        id: id('access'),
        workspaceId: row.workspaceId,
        userId: session.user.id,
        role: row.role,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [workspaceAccess.userId, workspaceAccess.workspaceId] }),
    db.insert(auditLog).values({
      id: id('audit'),
      workspaceId: row.workspaceId,
      actorId: session.user.email,
      action: 'access.invitation_accept',
      resourceType: 'workspace_invitation',
      resourceId: row.id,
      metadata: { note: `${session.user.email} — ${row.role}` },
      createdAt: now,
    }),
  ])

  revalidatePath('/console/access')
  revalidatePath('/console')
  revalidatePath('/portal')
  return {
    ok: true,
    message: `اكتمل ربط حسابك بـ ${row.workspaceName}.`,
    redirectTo: row.workspaceType === 'operator' ? '/console' : '/portal',
  }
}

export async function grantWorkspaceAccess(
  input: z.input<typeof grantSchema>,
): Promise<AccessActionResult> {
  const owner = await authorizeOperator('access.manage')
  if (!owner) return { ok: false, error: 'إدارة الوصول متاحة لمالك المنصة فقط.' }

  const parsed = grantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'تحقق من البريد والدور ومساحة العمل.' }

  const [targetWorkspace] = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, parsed.data.workspaceId))
    .limit(1)
  if (!targetWorkspace) return { ok: false, error: 'مساحة العمل غير موجودة.' }

  const roleFits =
    targetWorkspace.type === 'operator'
      ? isOperatorRole(parsed.data.role)
      : isClientRole(parsed.data.role)
  if (!roleFits) return { ok: false, error: 'هذا الدور لا يناسب نوع مساحة العمل.' }

  const [targetUser] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1)
  if (!targetUser) {
    return { ok: false, error: 'لا يوجد حساب بهذا البريد. أنشئ الحساب أولًا ثم أضف الوصول.' }
  }

  const [existing] = await db
    .select({ role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(
      and(
        eq(workspaceAccess.userId, targetUser.id),
        eq(workspaceAccess.workspaceId, targetWorkspace.id),
      ),
    )
    .limit(1)
  if (
    targetWorkspace.type === 'operator' &&
    existing?.role === 'owner' &&
    parsed.data.role !== 'owner'
  ) {
    const [owners] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workspaceAccess)
      .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
      .where(and(eq(workspace.type, 'operator'), eq(workspaceAccess.role, 'owner')))
    if ((owners?.count ?? 0) <= 1) {
      return { ok: false, error: 'لا يمكن تغيير دور آخر مالك للمنصة.' }
    }
  }

  const now = new Date()
  await db
    .insert(workspaceAccess)
    .values({
      id: id('access'),
      workspaceId: targetWorkspace.id,
      userId: targetUser.id,
      role: parsed.data.role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [workspaceAccess.userId, workspaceAccess.workspaceId],
      set: { role: parsed.data.role, updatedAt: now },
    })

  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: targetWorkspace.id,
    actorId: owner.email,
    action: 'access.grant',
    resourceType: 'workspace_access',
    resourceId: targetUser.id,
    metadata: { note: `${targetUser.email} — ${parsed.data.role}` },
    createdAt: now,
  })

  revalidatePath('/console/access')
  return { ok: true, message: `حُفظ وصول ${targetUser.email} إلى ${targetWorkspace.name}.` }
}

export async function revokeWorkspaceAccess(accessId: string): Promise<AccessActionResult> {
  const owner = await authorizeOperator('access.manage')
  if (!owner) return { ok: false, error: 'إدارة الوصول متاحة لمالك المنصة فقط.' }

  const [row] = await db
    .select({
      id: workspaceAccess.id,
      workspaceId: workspaceAccess.workspaceId,
      role: workspaceAccess.role,
      userId: workspaceAccess.userId,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
      email: user.email,
    })
    .from(workspaceAccess)
    .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
    .innerJoin(user, eq(workspaceAccess.userId, user.id))
    .where(eq(workspaceAccess.id, accessId))
    .limit(1)
  if (!row) return { ok: false, error: 'سجل الوصول غير موجود.' }

  if (row.workspaceType === 'operator' && row.role === 'owner') {
    const [owners] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workspaceAccess)
      .innerJoin(workspace, eq(workspaceAccess.workspaceId, workspace.id))
      .where(and(eq(workspace.type, 'operator'), eq(workspaceAccess.role, 'owner')))
    if ((owners?.count ?? 0) <= 1) {
      return { ok: false, error: 'لا يمكن إزالة آخر مالك للمنصة.' }
    }
  }

  await db.delete(workspaceAccess).where(eq(workspaceAccess.id, accessId))
  await db.insert(auditLog).values({
    id: id('audit'),
    workspaceId: row.workspaceId,
    actorId: owner.email,
    action: 'access.revoke',
    resourceType: 'workspace_access',
    resourceId: row.userId,
    metadata: { note: `${row.email} — ${row.role}` },
    createdAt: new Date(),
  })

  revalidatePath('/console/access')
  return { ok: true, message: `أُزيل وصول ${row.email} إلى ${row.workspaceName}.` }
}
