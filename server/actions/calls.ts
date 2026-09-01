'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { limitAction } from '@/server/actions/guard'
import { authorizeOperator } from '@/server/auth/access'
import { processCallIntelligence } from '@/server/calls/intelligence'
import { db } from '@/server/db'
import { auditLog, call } from '@/server/db/schema'

export type CallActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; refresh?: boolean }

const callIdSchema = z.string().trim().min(1).max(160)

export async function retryCallSummary(callId: string): Promise<CallActionResult> {
  const access = await authorizeOperator('qa.review')
  if (!access) return { ok: false, error: 'لا تملك صلاحية إعادة إعداد الملخص.' }
  const limited = limitAction('call_summary', access.userId)
  if (limited) return limited

  const parsed = callIdSchema.safeParse(callId)
  if (!parsed.success) return { ok: false, error: 'تعذر تحديد المكالمة.' }

  const [row] = await db
    .select({ id: call.id, workspaceId: call.workspaceId, origin: call.origin })
    .from(call)
    .where(eq(call.id, parsed.data))
    .limit(1)
  if (!row) return { ok: false, error: 'المكالمة غير موجودة.' }
  if (row.origin !== 'live') {
    return { ok: false, error: 'الملخص الذكي متاح للمكالمات الحقيقية فقط.' }
  }

  const result = await processCallIntelligence(row.id, { force: true })
  await db.insert(auditLog).values({
    id: `audit_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    workspaceId: row.workspaceId,
    actorId: access.email,
    action: 'call.summary.retry',
    resourceType: 'call',
    resourceId: row.id,
    metadata: { result: result.state },
    createdAt: new Date(),
  })

  revalidatePath('/console/calls')

  if (result.state === 'completed') {
    return { ok: true, message: 'تم إعداد ملخص المكالمة.' }
  }
  if (result.state === 'skipped') {
    return {
      ok: false,
      error:
        result.reason === 'call_not_finished'
          ? 'سنجهز الملخص بعد انتهاء المكالمة.'
          : 'نص الحوار غير متاح بعد، وسجل المكالمة محفوظ.',
      refresh: true,
    }
  }
  if (result.state === 'queued') {
    return { ok: true, message: 'الملخص قيد المعالجة وسيظهر تلقائيًا.' }
  }
  return {
    ok: false,
    error: 'تعذر إعداد الملخص الآن. سجل المكالمة محفوظ ويمكن المحاولة مرة أخرى.',
    refresh: true,
  }
}
