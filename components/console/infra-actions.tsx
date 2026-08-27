'use client'

import {
  ArrowLeftRight,
  CircleCheck,
  ExternalLink,
  PhoneCall,
  PlugZap,
  Plus,
  Power,
  Settings2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm, Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
  createPhoneNumber,
  getReassignTargets,
  type ReassignTarget,
  reassignPhoneNumber,
  requestPhoneTest,
  testIntegration,
  updateIntegrationConnection,
  updatePhoneRoute,
  updatePhoneState,
} from '@/server/actions/console'

/* ─── integrations ───────────────────────────────────────────────────────── */

type IntegrationAction = 'health' | 'availability' | 'booking' | 'message'

const INTEGRATION_FIELD: Record<IntegrationAction, { label: string; hint: string }> = {
  health: {
    label: 'عنوان فحص الاتصال',
    hint: 'طلب GET آمن لا يغيّر بيانات المزوّد.',
  },
  availability: {
    label: 'عنوان قراءة المواعيد',
    hint: 'يعيد JSON يحتوي slots: string[].',
  },
  booking: {
    label: 'عنوان تثبيت الحجز',
    hint: 'يعيد JSON يحتوي bookingId بعد نجاح الحجز الفعلي.',
  },
  message: {
    label: 'عنوان إرسال التأكيد',
    hint: 'يعيد messageId أو sent: true بعد الإرسال الفعلي.',
  },
}

export function IntegrationRowActions({
  id,
  label,
  capabilities,
  endpoints,
  credentialsRef,
}: {
  id: string
  label: string
  capabilities: IntegrationAction[]
  endpoints: Partial<Record<IntegrationAction, string | undefined>>
  credentialsRef: string | null
}) {
  const [open, setOpen] = useState(false)
  const [nextEndpoints, setNextEndpoints] = useState(endpoints)
  const [nextCredentialsRef, setNextCredentialsRef] = useState(credentialsRef ?? '')
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<Settings2 size={15} />} onClick={() => setOpen(true)}>
          إعداد الاتصال
        </RowAction>
        <RowAction
          icon={<PlugZap size={15} />}
          onClick={() => run(() => testIntegration(id))}
          disabled={pending}
        >
          اختبر الاتصال
        </RowAction>
      </RowActions>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`إعداد ${label}`}
        description="اضبط مسارات التنفيذ، واترك الأسرار داخل بيئة التشغيل لا داخل قاعدة البيانات."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateIntegrationConnection({
                      connectionId: id,
                      credentialsRef: nextCredentialsRef,
                      endpoints: nextEndpoints,
                    }),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'احفظ الإعداد'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-5)' }}>
          {capabilities.map((action) => (
            <div className="field" key={action}>
              <label htmlFor={`${action}-${id}`}>{INTEGRATION_FIELD[action].label}</label>
              <input
                id={`${action}-${id}`}
                className="input mono"
                dir="ltr"
                inputMode="url"
                value={nextEndpoints[action] ?? ''}
                onChange={(event) =>
                  setNextEndpoints((current) => ({
                    ...current,
                    [action]: event.target.value,
                  }))
                }
                placeholder={`https://api.example.com/mujawib/${action}`}
              />
              <span className="field__hint">{INTEGRATION_FIELD[action].hint}</span>
            </div>
          ))}

          <div className="field">
            <label htmlFor={`credential-${id}`}>مرجع المفتاح الآمن</label>
            <input
              id={`credential-${id}`}
              className="input mono"
              dir="ltr"
              value={nextCredentialsRef}
              onChange={(event) => setNextCredentialsRef(event.target.value)}
              placeholder="env:CLIENT_CALENDAR_TOKEN"
            />
            <span className="field__hint">
              اسم متغير البيئة فقط. لا تضع رمز الوصول أو كلمة المرور في هذا الحقل.
            </span>
          </div>
        </div>
      </Sheet>
    </>
  )
}

/* ─── phone numbers ──────────────────────────────────────────────────────── */

const MODES = [
  { value: 'all_calls', label: 'كل المكالمات' },
  { value: 'overflow', label: 'عند الازدحام فقط' },
  { value: 'after_hours', label: 'خارج الدوام فقط' },
] as const

export function PhoneRowActions({
  id,
  e164,
  mode,
  transferDestination,
  fallbackDisabled,
  agentId,
  agents,
  workspaceName,
  agentName,
}: {
  id: string
  e164: string
  mode: string
  transferDestination: string | null
  fallbackDisabled: boolean
  agentId?: string | null
  agents?: { id: string; label: string }[]
  workspaceName?: string | undefined
  agentName?: string | null | undefined
}) {
  const [open, setOpen] = useState(false)
  const [nextMode, setNextMode] = useState(mode)
  const [transfer, setTransfer] = useState(transferDestination ?? '')
  const [fallbackOff, setFallbackOff] = useState(fallbackDisabled)
  const [nextAgentId, setNextAgentId] = useState(agentId ?? '')
  const [moving, setMoving] = useState(false)
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<ExternalLink size={15} />} href={`/console/phone/${id}`}>
          افتح تفاصيل الرقم
        </RowAction>
        <RowAction icon={<Settings2 size={15} />} onClick={() => setOpen(true)}>
          تعديل التوجيه
        </RowAction>
        <RowAction icon={<ArrowLeftRight size={15} />} onClick={() => setMoving(true)}>
          انقله إلى عميل آخر
        </RowAction>
        <RowAction
          icon={<PhoneCall size={15} />}
          onClick={() => run(() => requestPhoneTest(id))}
          disabled={pending}
        >
          اطلب مكالمة اختبار
        </RowAction>
      </RowActions>

      <PhoneReassignSheet
        open={moving}
        onClose={() => setMoving(false)}
        phoneId={id}
        e164={e164}
        currentWorkspaceName={workspaceName ?? '—'}
        currentAgentName={agentName ?? null}
      />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`توجيه ${e164}`}
        description="متى يرد المُجاوِب على هذا الرقم، وإلى أين يحوّل عند التصعيد."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updatePhoneRoute({
                      phoneId: id,
                      mode: nextMode as (typeof MODES)[number]['value'],
                      agentId: nextAgentId || undefined,
                      transferDestination: transfer,
                      fallbackDisabled: fallbackOff,
                    }),
                  () => setOpen(false),
                )
              }
            >
              {pending ? 'جارٍ الحفظ…' : 'احفظ التوجيه'}
            </Button>
          </>
        }
      >
        {agents?.length ? (
          <div className="field">
            <label htmlFor={`agent-${id}`}>الموظف الصوتي</label>
            <select
              id={`agent-${id}`}
              className="input"
              value={nextAgentId}
              onChange={(event) => setNextAgentId(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor={`mode-${id}`}>وضع الاستقبال</label>
          <select
            id={`mode-${id}`}
            className="input"
            value={nextMode}
            onChange={(e) => setNextMode(e.target.value)}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`transfer-${id}`}>رقم التحويل عند التصعيد</label>
          <input
            id={`transfer-${id}`}
            className="input mono"
            value={transfer}
            onChange={(e) => setTransfer(e.target.value)}
            placeholder="+966551200430"
            disabled={fallbackOff}
          />
          <span className="field__hint">
            إليه تُحوَّل المكالمة عندما يطلب العميل موظفًا، أو عندما يتعذّر إنجاز الطلب.
          </span>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={fallbackOff}
            onChange={(event) => setFallbackOff(event.target.checked)}
          />
          <span>
            تعطيل التحويل لهذا الاختبار
            <small>قرار مقصود لمسار الاختبار، وليس إعدادًا افتراضيًا للعملاء.</small>
          </span>
        </label>
      </Sheet>
    </>
  )
}

export function PhoneLifecycleActions({ id, status }: { id: string; status: string | null }) {
  const { run, pending } = useAction()

  return (
    <div className="cluster">
      {status !== 'active' ? (
        <Button
          variant="primary"
          size="sm"
          leading={<CircleCheck size={15} />}
          disabled={pending}
          onClick={() => run(() => updatePhoneState({ phoneId: id, action: 'activate' }))}
        >
          تفعيل المسار
        </Button>
      ) : null}
      {status !== 'disabled' ? (
        <Button
          variant="danger"
          size="sm"
          leading={<Power size={15} />}
          disabled={pending}
          onClick={() => run(() => updatePhoneState({ phoneId: id, action: 'disable' }))}
        >
          تعطيل
        </Button>
      ) : null}
    </div>
  )
}

/* ─── moving a number between clients ────────────────────────────────────── */

/**
 * Reassignment of a DID to a different client and voice employee.
 *
 * Kept beside the routing sheet rather than on its own screen, because the
 * operator reaches for it from the same place — the number's row — and the
 * distinction that matters is between changing how a number behaves for its
 * client and changing which client it belongs to. The second one wipes the
 * number's verification, so it asks for confirmation and says what it costs.
 */
function PhoneReassignSheet({
  open,
  onClose,
  phoneId,
  e164,
  currentWorkspaceName,
  currentAgentName,
}: {
  open: boolean
  onClose: () => void
  phoneId: string
  e164: string
  currentWorkspaceName: string
  currentAgentName: string | null
}) {
  const [targets, setTargets] = useState<ReassignTarget[] | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { run, pending } = useAction()

  // Loaded when the sheet opens rather than with the page: this list is only
  // needed by the operator who is actually moving a number.
  useEffect(() => {
    if (!open || targets) return
    let cancelled = false
    getReassignTargets().then((result) => {
      if (!cancelled && result.ok) setTargets(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [open, targets])

  const selectedWorkspace = targets?.find((target) => target.workspaceId === workspaceId)
  const selectedAgent = selectedWorkspace?.agents.find((agent) => agent.agentId === agentId)
  const ready = Boolean(selectedAgent?.publishable)

  function choose(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId)
    // Pre-pick the only agent that can answer, if there is exactly one.
    const workspace = targets?.find((target) => target.workspaceId === nextWorkspaceId)
    const publishable = workspace?.agents.filter((agent) => agent.publishable) ?? []
    setAgentId(publishable.length === 1 ? (publishable[0]?.agentId ?? '') : '')
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`نقل ${e164} إلى عميل آخر`}
        description="الرقم الواحد يخدم عميلًا واحدًا فقط. النقل يحوّل كل المكالمات القادمة على هذا الرقم إلى الموظف الصوتي الذي تختاره."
        footer={
          <>
            <Button onClick={onClose} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={!ready || pending}
              onClick={() => setConfirming(true)}
            >
              راجع النقل
            </Button>
          </>
        }
      >
        <dl className="route-now">
          <dt>يرد عليه الآن</dt>
          <dd>
            {currentWorkspaceName}
            {currentAgentName ? ` · ${currentAgentName}` : ''}
          </dd>
        </dl>

        {targets === null ? (
          <p className="muted">جارٍ تحميل العملاء…</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor={`ws-${phoneId}`}>العميل الجديد</label>
              <select
                id={`ws-${phoneId}`}
                className="input"
                value={workspaceId}
                onChange={(event) => choose(event.target.value)}
              >
                <option value="">اختر عميلًا…</option>
                {targets.map((target) => (
                  <option key={target.workspaceId} value={target.workspaceId}>
                    {target.workspaceName}
                  </option>
                ))}
              </select>
            </div>

            {selectedWorkspace ? (
              <div className="field">
                <label htmlFor={`ag-${phoneId}`}>الموظف الصوتي الذي سيرد</label>
                <select
                  id={`ag-${phoneId}`}
                  className="input"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                >
                  <option value="">اختر موظفًا…</option>
                  {selectedWorkspace.agents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId} disabled={!agent.publishable}>
                      {agent.agentName}
                      {agent.publishable
                        ? ` — v${agent.versionNumber} منشورة`
                        : ' — لا توجد نسخة منشورة'}
                    </option>
                  ))}
                </select>
                {selectedWorkspace.agents.length === 0 ? (
                  <span className="field__error">
                    لا يوجد موظف صوتي لدى هذا العميل. أنشئ موظفًا وانشر نسخة منه أولًا.
                  </span>
                ) : (
                  <span className="field__hint">
                    الموظف بلا نسخة منشورة لا يستطيع الرد، فلا يمكن توجيه الرقم إليه.
                  </span>
                )}
              </div>
            ) : null}
          </>
        )}
      </Sheet>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          run(
            () => reassignPhoneNumber({ phoneId, workspaceId, agentId }),
            () => {
              setConfirming(false)
              onClose()
            },
          )
        }
        title={`نقل ${e164}؟`}
        body={`سيرد «${selectedAgent?.agentName ?? ''}» لدى ${selectedWorkspace?.workspaceName ?? ''} على كل مكالمة قادمة على هذا الرقم. توثيق المسار الحالي ووجهة التحويل يسقطان، ويحتاج الرقم مكالمة حقيقية جديدة ليعود موثّقًا.`}
        confirmLabel="انقل الرقم"
        pending={pending}
      />
    </>
  )
}

/* ─── add phone number ───────────────────────────────────────────────────── */

/**
 * The only way to register a number used to be `pnpm voice:link-number` from
 * a shell with production database access — an operator with `phone.manage`
 * and nothing else could not connect a client's number without asking
 * someone to run a command for them. This is the same insert, from the
 * console. It does not provision anything with a carrier: the SIP trunk
 * connection is still the operations-team step the page already describes
 * above — this only removes the terminal from *entering* the number, not
 * from wiring the trunk itself.
 */
export function AddPhoneNumberAction({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(clients[0]?.id ?? '')
  const [e164, setE164] = useState('')
  const [label, setLabel] = useState('')
  const { run, pending } = useAction()

  const valid = /^\+[1-9]\d{7,14}$/.test(e164.trim()) && workspaceId

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
        disabled={clients.length === 0}
        title={clients.length === 0 ? 'أضف عميلًا أولًا' : undefined}
      >
        ربط رقم
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="ربط رقم جديد"
        description="يسجَّل الرقم بحالة «بانتظار أول مكالمة» — يثبته وصول مكالمة حقيقية عليه، لا هذا النموذج."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={pending || !valid}
              onClick={() =>
                run(
                  () =>
                    createPhoneNumber({
                      workspaceId,
                      e164: e164.trim(),
                      label: label.trim() || undefined,
                    }),
                  () => {
                    setOpen(false)
                    setE164('')
                    setLabel('')
                  },
                )
              }
            >
              {pending ? 'جارٍ الربط…' : 'اربط الرقم'}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="new-phone-client">العميل</label>
          <select
            id="new-phone-client"
            className="input"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="new-phone-e164">الرقم بصيغة دولية</label>
          <input
            id="new-phone-e164"
            className="input mono"
            dir="ltr"
            inputMode="tel"
            value={e164}
            onChange={(event) => setE164(event.target.value)}
            placeholder="+966920012130"
          />
          <span className="field__hint">يبدأ بـ + ورمز الدولة، بلا مسافات أو رموز أخرى.</span>
        </div>

        <div className="field">
          <label htmlFor="new-phone-label">تسمية (اختياري)</label>
          <input
            id="new-phone-label"
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="الفرع الرئيسي"
          />
        </div>
      </Sheet>
    </>
  )
}
