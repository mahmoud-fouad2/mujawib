'use client'

import { CopyPlus, Rocket, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Confirm } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { createAgentDraft, publishVersion, rollbackAgent } from '@/server/actions/console'

export function AgentRowActions({
  agentId,
  agentName,
  draftVersionId,
  draftNumber,
  blockers,
  canRollback,
}: {
  agentId: string
  agentName: string
  draftVersionId: string | null
  draftNumber: number | null
  blockers: string[]
  canRollback: boolean
}) {
  const [confirm, setConfirm] = useState<'publish' | 'rollback' | null>(null)
  const { run, pending } = useAction()

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
    </>
  )
}
