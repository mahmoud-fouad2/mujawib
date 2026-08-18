'use client'

import { PhoneCall, PlugZap, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { requestPhoneTest, testIntegration, updatePhoneRoute } from '@/server/actions/console'

/* ─── integrations ───────────────────────────────────────────────────────── */

export function IntegrationRowActions({ id, label }: { id: string; label: string }) {
  const { run, pending } = useAction()

  return (
    <RowActions>
      <RowAction
        icon={<PlugZap size={15} />}
        onClick={() => run(() => testIntegration(id))}
        disabled={pending}
      >
        اختبر الاتصال
      </RowAction>
      <RowAction
        icon={<Settings2 size={15} />}
        onClick={() => {}}
        disabled
        title="يضبطه فريق الربط"
      >
        بيانات الاعتماد — {label}
      </RowAction>
    </RowActions>
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
}: {
  id: string
  e164: string
  mode: string
  transferDestination: string | null
}) {
  const [open, setOpen] = useState(false)
  const [nextMode, setNextMode] = useState(mode)
  const [transfer, setTransfer] = useState(transferDestination ?? '')
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
                      transferDestination: transfer,
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
          />
          <span className="field__hint">
            إليه تُحوَّل المكالمة عندما يطلب العميل موظفًا، أو عندما يتعذّر إنجاز الطلب.
          </span>
        </div>
      </Sheet>
    </>
  )
}
