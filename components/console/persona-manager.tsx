'use client'

import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  PERSONA_DIALECT_LABEL,
  PERSONA_GENDER_LABEL,
  PERSONA_LANGUAGE_LABEL,
  personasPerProviderVoice,
} from '@/lib/voice-personas'
import {
  deleteVoicePersona,
  duplicateVoicePersona,
  saveVoicePersona,
} from '@/server/actions/console'

/**
 * Persona management, on the page that previously only listed them.
 *
 * `/console/voice-lab` showed a read-only table: an operator could see the ten
 * platform voices and a client's own copies, and could do nothing with either.
 * The actions existed; nothing rendered them.
 *
 * The protection rule is enforced in the Server Action, not here. This file
 * hides the controls on a protected row because showing a button that always
 * fails is worse than showing none — but hiding it is presentation, and a
 * `'use server'` function is a POST endpoint whose id ships in this bundle.
 */

export type PersonaRow = {
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

export type ClientOption = { id: string; name: string }

const STYLE_LABEL: Record<string, string> = {
  professional: 'احترافي',
  warm: 'ودود',
  concise: 'موجز',
  premium: 'راقٍ',
}

type FormState = {
  workspaceId: string
  name: string
  dialect: 'saudi' | 'gulf' | 'egyptian' | 'lebanese' | 'msa' | 'english'
  style: 'professional' | 'warm' | 'concise' | 'premium'
  gender: 'male' | 'female'
  language: 'ar' | 'en'
  providerVoice: 'cedar' | 'marin'
  pacingPreset: 'measured' | 'brisk'
  country: string
}

function formFor(clients: ClientOption[], row?: PersonaRow): FormState {
  return {
    workspaceId: row?.workspaceId ?? clients[0]?.id ?? '',
    name: row?.name ?? '',
    dialect: (row?.dialect ?? 'saudi') as FormState['dialect'],
    style: (row?.style ?? 'professional') as FormState['style'],
    gender: row?.gender ?? 'female',
    language: row?.language ?? 'ar',
    providerVoice: (row?.providerVoice ?? 'marin') as FormState['providerVoice'],
    pacingPreset: 'measured',
    country: 'SA',
  }
}

function PersonaSheet({
  clients,
  row,
  open,
  onClose,
}: {
  clients: ClientOption[]
  row?: PersonaRow
  open: boolean
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(() => formFor(clients, row))
  const { run, pending } = useAction()

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const shared = personasPerProviderVoice()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={row ? 'تعديل الشخصية الصوتية' : 'شخصية صوتية مخصصة'}
      description="شخصية يملكها عميل واحد — غير مشتركة مع بقية العملاء، وقابلة للتعديل والحذف."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || form.name.trim().length < 2 || !form.workspaceId}
            onClick={() =>
              run(() => saveVoicePersona({ ...(row ? { id: row.id } : {}), ...form }), onClose)
            }
          >
            {pending ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="persona-client">العميل</label>
        <select
          id="persona-client"
          className="input"
          value={form.workspaceId}
          disabled={Boolean(row)}
          onChange={(e) => set('workspaceId', e.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {row ? <span className="hint">لا يمكن نقل شخصية بين العملاء.</span> : null}
      </div>

      <div className="field">
        <label htmlFor="persona-name">الاسم</label>
        <input
          id="persona-name"
          className="input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ريم"
        />
      </div>

      <div className="field">
        <label htmlFor="persona-dialect">اللهجة</label>
        <select
          id="persona-dialect"
          className="input"
          value={form.dialect}
          onChange={(e) => set('dialect', e.target.value as FormState['dialect'])}
        >
          {Object.entries(PERSONA_DIALECT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="persona-language">اللغة الأساسية</label>
        <select
          id="persona-language"
          className="input"
          value={form.language}
          onChange={(e) => set('language', e.target.value as FormState['language'])}
        >
          {Object.entries(PERSONA_LANGUAGE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="persona-gender">الجنس المعروض</label>
        <select
          id="persona-gender"
          className="input"
          value={form.gender}
          onChange={(e) => set('gender', e.target.value as FormState['gender'])}
        >
          {Object.entries(PERSONA_GENDER_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="persona-style">الأسلوب</label>
        <select
          id="persona-style"
          className="input"
          value={form.style}
          onChange={(e) => set('style', e.target.value as FormState['style'])}
        >
          {Object.entries(STYLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="persona-voice">صوت المزوّد</label>
        <select
          id="persona-voice"
          className="input"
          value={form.providerVoice}
          onChange={(e) => set('providerVoice', e.target.value as FormState['providerVoice'])}
        >
          <option value="marin">marin</option>
          <option value="cedar">cedar</option>
        </select>
        {/*
          Stated, not hidden. The provider offers fewer voices than the
          platform has personas, so the difference between two of them is
          dialect and pacing, not timbre — an operator picking one should know
          that before a client asks why two assistants sound alike.
        */}
        <span className="hint">
          الأصوات المتاحة صوتان فقط: marin ({shared.marin ?? 0} شخصية افتراضية) و cedar (
          {shared.cedar ?? 0}). الفرق بين الشخصيات هو اللهجة والإيقاع، لا طبقة الصوت.
        </span>
      </div>

      <div className="field">
        <label htmlFor="persona-pacing">الإيقاع</label>
        <select
          id="persona-pacing"
          className="input"
          value={form.pacingPreset}
          onChange={(e) => set('pacingPreset', e.target.value as FormState['pacingPreset'])}
        >
          <option value="measured">متأنٍّ — يترك مساحة أطول قبل الرد</option>
          <option value="brisk">سريع — يرد أسرع، مناسب للهجات المتصلة</option>
        </select>
        <span className="hint">
          يحدد نافذة الصمت التي يعتبرها الموظف نهاية كلام المتصل. النافذة القصيرة تقطع المتحدث.
        </span>
      </div>
    </Sheet>
  )
}

export function AddPersona({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        disabled={clients.length === 0}
        onClick={() => setOpen(true)}
      >
        شخصية مخصصة
      </Button>
      {open ? <PersonaSheet clients={clients} open={open} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function PersonaRowActions({ row, clients }: { row: PersonaRow; clients: ClientOption[] }) {
  const [editing, setEditing] = useState(false)
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copyTo, setCopyTo] = useState(clients[0]?.id ?? '')
  const { run, pending } = useAction()

  const locked = row.isGlobal || row.isProtected

  return (
    <>
      <RowActions label={`خيارات ${row.name}`}>
        {locked ? null : <RowAction onClick={() => setEditing(true)}>تعديل</RowAction>}
        <RowAction onClick={() => setCopying(true)} icon={<Copy size={14} />}>
          نسخ إلى عميل
        </RowAction>
        {locked ? null : (
          <RowAction onClick={() => setDeleting(true)} tone="danger" icon={<Trash2 size={14} />}>
            حذف
          </RowAction>
        )}
      </RowActions>

      {editing ? (
        <PersonaSheet
          clients={clients}
          row={row}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}

      {copying ? (
        <Sheet
          open
          onClose={() => setCopying(false)}
          title={`نسخ «${row.name}»`}
          description="تُنشأ نسخة يملكها العميل وحده — قابلة للتعديل، وغير مرتبطة بالأصل."
          footer={
            <>
              <Button onClick={() => setCopying(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                disabled={pending || !copyTo}
                onClick={() =>
                  run(
                    () => duplicateVoicePersona({ voiceProfileId: row.id, workspaceId: copyTo }),
                    () => setCopying(false),
                  )
                }
              >
                {pending ? 'جارٍ النسخ…' : 'نسخ'}
              </Button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="persona-copy-to">العميل</label>
            <select
              id="persona-copy-to"
              className="input"
              value={copyTo}
              onChange={(e) => setCopyTo(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        </Sheet>
      ) : null}

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          run(
            () => deleteVoicePersona(row.id),
            () => setDeleting(false),
          )
        }
        title={`حذف «${row.name}»؟`}
        body="يُرفض الحذف إذا كانت الشخصية مستخدمة في نسخة موظف صوتي — غيّرها هناك أولًا."
        confirmLabel="حذف"
        tone="danger"
        pending={pending}
      />
    </>
  )
}
