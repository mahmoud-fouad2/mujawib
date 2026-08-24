'use client'

import { CopyPlus, Rocket, Trash2, Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Confirm } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  createAgentDraft,
  deleteAgent,
  publishVersion,
  rollbackAgent,
} from '@/server/actions/console'

export function AgentRowActions({
  agentId,
  agentName,
  draftVersionId,
  draftNumber,
  blockers,
  canRollback,
  isPublished,
  deleteRedirectTo,
}: {
  agentId: string
  agentName: string
  draftVersionId: string | null
  draftNumber: number | null
  blockers: string[]
  canRollback: boolean
  /** Delete is refused once a version has gone live — offer it, but explain why. */
  isPublished: boolean
  /**
   * The detail page is the deleted agent's own page — after removing it,
   * stay there rather than on a page describing a resource that is now gone.
   * The list page omits this: the row simply revalidates away.
   */
  deleteRedirectTo?: string
}) {
  const [confirm, setConfirm] = useState<'publish' | 'rollback' | 'delete' | null>(null)
  const { run, pending } = useAction()
  const router = useRouter()

  const blocked = blockers.length > 0
  const publishTitle = !draftVersionId ? 'لا توجد مسودة للنشر' : blocked ? blockers[0] : undefined

  return (
    <>
      <RowActions>
        {!draftVersionId ? (
          <RowAction
            icon={<CopyPlus size={15} />}
            onClick={() => run(() => createAgentDraft(agentId))}
            disabled={pending}
            title="أنشئ نسخة قابلة للتحرير من النسخة المنشورة"
          >
            إنشاء مسودة
          </RowAction>
        ) : null}
        <RowAction
          icon={<Rocket size={15} />}
          onClick={() => setConfirm('publish')}
          disabled={!draftVersionId || blocked}
          title={publishTitle}
        >
          {draftNumber ? `نشر v${draftNumber}` : 'نشر المسودة'}
        </RowAction>
        <RowAction
          icon={<Undo2 size={15} />}
          onClick={() => setConfirm('rollback')}
          disabled={!canRollback}
          title={canRollback ? undefined : 'لا توجد نسخة سابقة'}
        >
          الرجوع للنسخة السابقة
        </RowAction>
        <RowAction
          icon={<Trash2 size={15} />}
          tone="danger"
          onClick={() => setConfirm('delete')}
          disabled={isPublished}
          title={isPublished ? 'لديه نسخة منشورة — ألغِ النشر أو ارجع لنسخة سابقة أولًا' : undefined}
        >
          حذف
        </RowAction>
      </RowActions>

      <Confirm
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          draftVersionId &&
          run(
            () => publishVersion(draftVersionId),
            () => setConfirm(null),
          )
        }
        title={`نشر v${draftNumber} لـ ${agentName}؟`}
        body="ستبدأ المكالمات الجديدة على هذه النسخة فورًا. المكالمات الجارية تكمل على النسخة الحالية، ويمكنك الرجوع في أي لحظة."
        confirmLabel="انشر الآن"
        pending={pending}
      />

      <Confirm
        open={confirm === 'rollback'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(
            () => rollbackAgent(agentId),
            () => setConfirm(null),
          )
        }
        title={`الرجوع بـ ${agentName} للنسخة السابقة؟`}
        body="ستعود المكالمات الجديدة إلى آخر نسخة منشورة قبل الحالية."
        confirmLabel="ارجع"
        pending={pending}
      />

      <Confirm
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(
            () => deleteAgent(agentId),
            () => {
              setConfirm(null)
              if (deleteRedirectTo) router.push(deleteRedirectTo)
            },
          )
        }
        title={`حذف ${agentName}؟`}
        body="يُرفض الحذف تلقائيًا إن كان لديه نسخة منشورة، أو رقم هاتف موجّه إليه، أو مكالمات مسجّلة — احذفه فقط إن لم يخرج للاستخدام الفعلي بعد. لا يمكن التراجع عن الحذف."
        confirmLabel="احذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
