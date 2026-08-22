'use client'

import { CircleCheck, PhoneCall, PlugZap, Power, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import {
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
}: {
  id: string
  e164: string
  mode: string
  transferDestination: string | null
  fallbackDisabled: boolean
  agentId?: string | null
  agents?: { id: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [nextMode, setNextMode] = useState(mode)
  const [transfer, setTransfer] = useState(transferDestination ?? '')
  const [fallbackOff, setFallbackOff] = useState(fallbackDisabled)
  const [nextAgentId, setNextAgentId] = useState(agentId ?? '')
  const { run, pending } = useAction()

  return (
    <>
      <RowActions>
        <RowAction icon={<Settings2 size={15} />} onClick={() => setOpen(true)}>
          تعديل التوجيه
        </RowAction>
        <RowAction
          icon={<PhoneCall size={15} />}
          onClick={() => run(() => requestPhoneTest(id))}
          disabled={pending}
        >
          اطلب مكالمة اختبار
        </RowAction>
      </RowActions>

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
