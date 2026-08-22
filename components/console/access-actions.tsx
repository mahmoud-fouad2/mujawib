'use client'

import { Check, Copy, MailPlus, ShieldMinus, ShieldX } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { useToast } from '@/components/ui/toast'
import {
  ACCESS_ROLE_LABEL,
  CLIENT_ROLES,
  type ClientRole,
  OPERATOR_ROLES,
  type OperatorRole,
} from '@/lib/access'
import {
  createWorkspaceInvitation,
  revokeWorkspaceAccess,
  revokeWorkspaceInvitation,
} from '@/server/actions/access'

type WorkspaceOption = { id: string; name: string; type: 'operator' | 'client' }

export function AddAccessButton({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const selected = workspaces.find((workspace) => workspace.id === workspaceId)
  const roles = useMemo(
    () => (selected?.type === 'operator' ? OPERATOR_ROLES : CLIENT_ROLES),
    [selected?.type],
  )
  const [role, setRole] = useState<string>(roles[0] ?? '')
  const [inviteUrl, setInviteUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [pending, startTransition] = useTransition()
  const toast = useToast()

  function selectWorkspace(value: string) {
    setWorkspaceId(value)
    const target = workspaces.find((workspace) => workspace.id === value)
    setRole(target?.type === 'operator' ? OPERATOR_ROLES[0] : CLIENT_ROLES[0])
  }

  function close() {
    setOpen(false)
    setInviteUrl('')
    setExpiresAt('')
  }

  function createInvitation() {
    startTransition(async () => {
      const result = await createWorkspaceInvitation({ email, workspaceId, role })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setInviteUrl(result.data.inviteUrl)
      setExpiresAt(result.data.expiresAt)
      toast.success(result.message)
    })
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('نُسخ رابط الدعوة.')
    } catch {
      toast.error('تعذر النسخ تلقائيًا. حدّد الرابط وانسخه يدويًا.')
    }
  }

  return (
    <>
      <Button variant="primary" leading={<MailPlus size={16} />} onClick={() => setOpen(true)}>
        دعوة مستخدم
      </Button>
      <Sheet
        open={open}
        onClose={close}
        title={inviteUrl ? 'الدعوة جاهزة' : 'دعوة مستخدم'}
        description={
          inviteUrl
            ? 'انسخ الرابط الآن؛ حفاظًا على الأمان لن نعرضه مرة أخرى.'
            : 'حدّد البريد ومساحة العمل، وسيكتمل الربط بعد قبول الدعوة.'
        }
        footer={
          inviteUrl ? (
            <>
              <Button onClick={close}>إغلاق</Button>
              <Button variant="primary" leading={<Copy size={16} />} onClick={copyInvitation}>
                نسخ الرابط
              </Button>
            </>
          ) : (
            <>
              <Button onClick={close} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                disabled={pending || !email || !workspaceId || !role}
                onClick={createInvitation}
              >
                {pending ? 'جارٍ الإنشاء…' : 'أنشئ الدعوة'}
              </Button>
            </>
          )
        }
      >
        {inviteUrl ? (
          <div className="invite-result">
            <div className="invite-result__head">
              <span className="invite-result__mark" aria-hidden="true">
                <Check size={18} />
              </span>
              <div>
                <strong>دعوة أحادية الاستخدام</strong>
                <p>
                  صالحة حتى{' '}
                  {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
                    new Date(expiresAt),
                  )}
                </p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="invitation-url">رابط الدعوة</label>
              <input
                id="invitation-url"
                className="input mono"
                dir="ltr"
                readOnly
                value={inviteUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <span className="field__hint">
                لا يحتوي السجل على هذا الرمز؛ إلغاء الدعوة ينهي صلاحيته فورًا.
              </span>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-5)' }}>
            <div className="field">
              <label htmlFor="access-email">البريد الإلكتروني</label>
              <input
                id="access-email"
                className="input"
                dir="ltr"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
              />
              <span className="field__hint">
                يجب أن يقبل المستخدم الدعوة بالحساب الذي يحمل هذا البريد.
              </span>
            </div>
            <div className="field">
              <label htmlFor="access-workspace">مساحة العمل</label>
              <select
                id="access-workspace"
                className="input"
                value={workspaceId}
                onChange={(event) => selectWorkspace(event.target.value)}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} — {workspace.type === 'operator' ? 'تشغيل' : 'عميل'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="access-role">الدور</label>
              <select
                id="access-role"
                className="input"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {roles.map((option: OperatorRole | ClientRole) => (
                  <option key={option} value={option}>
                    {ACCESS_ROLE_LABEL[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}

export function InvitationRowActions({
  id,
  email,
  workspaceName,
}: {
  id: string
  email: string
  workspaceName: string
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<ShieldX size={15} />} tone="danger" onClick={() => setOpen(true)}>
          إلغاء الدعوة
        </RowAction>
      </RowActions>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إلغاء الدعوة"
        description={`لن يستطيع ${email} استخدام رابط ${workspaceName} بعد الإلغاء.`}
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              احتفظ بالدعوة
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeWorkspaceInvitation(id),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الإلغاء…' : 'ألغِ الدعوة'}
            </Button>
          </>
        }
      >
        <p className="muted">يمكن إنشاء دعوة جديدة للبريد نفسه لاحقًا بدور أو مدة جديدة.</p>
      </Sheet>
    </>
  )
}

export function AccessRowActions({
  id,
  email,
  workspaceName,
}: {
  id: string
  email: string
  workspaceName: string
}) {
  const [open, setOpen] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<ShieldMinus size={15} />} onClick={() => setOpen(true)}>
          إزالة الوصول
        </RowAction>
      </RowActions>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="إزالة الوصول"
        description={`لن يعود ${email} قادرًا على فتح ${workspaceName}.`}
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              احتفظ بالوصول
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeWorkspaceAccess(id),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الإزالة…' : 'أزل الوصول'}
            </Button>
          </>
        }
      >
        <p className="muted">
          لا تُحذف هوية المستخدم أو سجلاته السابقة؛ يتوقف فقط وصوله إلى مساحة العمل المحددة.
        </p>
      </Sheet>
    </>
  )
}
