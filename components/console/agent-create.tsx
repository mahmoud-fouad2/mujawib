'use client'

import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { PERSONA_GENDER_LABEL, personaByKey } from '@/lib/voice-personas'
import { createVoiceAgent } from '@/server/actions/console'

type ClientOption = { id: string; name: string; slug: string }
type ProfileOption = {
  id: string
  workspaceId: string | null
  name: string
  dialect: string
  style: string
  isGlobal: boolean
  personaKey: string | null
  gender: 'male' | 'female' | null
  language: 'ar' | 'en'
  providerVoice: string
  isProtected: boolean
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

  // The database is the source of truth for personas now, so selection is an
  // exact id rather than a fuzzy match between a hardcoded list and whatever
  // rows happen to exist. Picking a persona also names the assistant, unless
  // the operator already typed a name.
  const applyProfile = (profile: ProfileOption) => {
    setVoiceProfileId(profile.id)
    if (!name.trim()) setName(profile.name.split('—')[0]?.trim() || profile.name)
  }

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
        <section className="voice-persona-grid" aria-label="اختيار شخصية الموظف الصوتي">
          {availableProfiles.map((profile) => {
            const persona = profile.personaKey ? personaByKey(profile.personaKey) : null
            const active = profile.id === voiceProfileId
            return (
              <button
                key={profile.id}
                type="button"
                className="voice-persona"
                data-active={active ? 'true' : 'false'}
                onClick={() => applyProfile(profile)}
              >
                <strong>{profile.name}</strong>
                <span>{persona?.description ?? `${profile.dialect} · ${profile.style}`}</span>
                <small>
                  {profile.gender ? PERSONA_GENDER_LABEL[profile.gender] : 'غير محدد'}
                  {' · '}
                  {profile.language === 'en' ? 'الإنجليزية' : 'العربية'}
                  {' · '}
                  {/* Stated, not hidden: several personas share one provider
                      voice, so an operator choosing between them knows the
                      difference is dialect and pacing, not timbre. */}
                  <span className="mono">{profile.providerVoice}</span>
                </small>
              </button>
            )
          })}
        </section>

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
