'use client'

import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { createVoiceAgent } from '@/server/actions/console'

type ClientOption = { id: string; name: string; slug: string }
type ProfileOption = {
  id: string
  workspaceId: string | null
  name: string
  dialect: string
  style: string
  isGlobal: boolean
}

export function AgentCreateSheet({
  clients,
  profiles,
  initialWorkspaceId,
}: {
  clients: ClientOption[]
  profiles: ProfileOption[]
  initialWorkspaceId?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? clients[0]?.id ?? '')
  const [name, setName] = useState('')
  const availableProfiles = useMemo(
    () => profiles.filter((profile) => profile.isGlobal || profile.workspaceId === workspaceId),
    [profiles, workspaceId],
  )
  const [voiceProfileId, setVoiceProfileId] = useState(
    availableProfiles[0]?.id ?? profiles[0]?.id ?? '',
  )
  const { run, pending } = useAction()

  const close = () => {
    setOpen(false)
    setName('')
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
        disabled={clients.length === 0 || profiles.length === 0}
      >
        إنشاء موظف صوتي
      </Button>

      <Sheet
        open={open}
        onClose={close}
        title="إنشاء موظف صوتي"
        description="ابدأ بمسودة كاملة وسيناريوهات قياس، ثم راجعها واختبرها قبل النشر."
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || !workspaceId || !voiceProfileId || name.trim().length < 2}
              onClick={() =>
                run(() => createVoiceAgent({ workspaceId, name, voiceProfileId }), close)
              }
            >
              {pending ? 'جارٍ الإنشاء…' : 'أنشئ المسودة'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="agent-client">العميل</label>
          <select
            id="agent-client"
            className="input"
            value={workspaceId}
            onChange={(event) => {
              const nextWorkspaceId = event.target.value
              setWorkspaceId(nextWorkspaceId)
              const nextProfile = profiles.find(
                (profile) => profile.isGlobal || profile.workspaceId === nextWorkspaceId,
              )
              setVoiceProfileId(nextProfile?.id ?? '')
            }}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="agent-name">اسم الموظف</label>
          <input
            id="agent-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="مثال: ياسمين"
            autoComplete="off"
          />
          <span className="field__hint">سيستخدمه الموظف عند التعريف بنفسه في المكالمة.</span>
        </div>

        <div className="field">
          <label htmlFor="agent-profile">ملف الصوت</label>
          <select
            id="agent-profile"
            className="input"
            value={voiceProfileId}
            onChange={(event) => setVoiceProfileId(event.target.value)}
          >
            {availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.dialect} · {profile.style}
              </option>
            ))}
          </select>
        </div>
      </Sheet>
    </>
  )
}
