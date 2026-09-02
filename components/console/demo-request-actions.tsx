'use client'

import { PhoneCall } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { blockDemoSource, placeDemoCall, setDemoRequestStatus } from '@/server/actions/demo-call'

/**
 * The operator half of the public demo call.
 *
 * Placing the call is a confirmation that names the number, because it is the
 * only control on this page that reaches somebody's phone — and the number was
 * typed by a stranger into a public form, so an operator should read it before
 * it is dialled rather than after.
 */

export type DemoVersionOption = {
  id: string
  label: string
  workspaceId: string
}

export type DemoNumberOption = {
  id: string
  e164: string
  workspaceId: string
}

export function DemoRequestActions({
  requestId,
  phone,
  status,
  versions,
  numbers,
  dialerReady,
}: {
  requestId: string
  phone: string
  status: string
  versions: DemoVersionOption[]
  numbers: DemoNumberOption[]
  dialerReady: boolean
}) {
  const [calling, setCalling] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blockScope, setBlockScope] = useState<'phone' | 'fingerprint'>('phone')
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '')
  const [numberId, setNumberId] = useState('')
  const [note, setNote] = useState('')
  const { run, pending } = useAction()

  const actionable = ['pending_verification', 'verified', 'new', 'approved', 'failed'].includes(
    status,
  )
  // The number has to belong to the same workspace as the assistant; the
  // action re-checks, and narrowing here stops an operator picking a pair the
  // server will only reject after they have clicked.
  const chosen = versions.find((v) => v.id === versionId)
  const eligibleNumbers = chosen ? numbers.filter((n) => n.workspaceId === chosen.workspaceId) : []

  if (!actionable) return null

  return (
    <>
      <RowActions label="خيارات الطلب">
        <RowAction onClick={() => setCalling(true)} icon={<PhoneCall size={14} />}>
          اتصل الآن
        </RowAction>
        <RowAction onClick={() => setRejecting(true)} tone="danger">
          رفض
        </RowAction>
        <RowAction onClick={() => setBlocking(true)} tone="danger">
          حظر دائم
        </RowAction>
      </RowActions>

      {calling ? (
        <Sheet
          open
          onClose={() => setCalling(false)}
          title="إجراء المكالمة التجريبية"
          description="اختر الموظف الصوتي الذي سيتحدث والرقم الذي ستظهر منه المكالمة."
          footer={
            <>
              <Button onClick={() => setCalling(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                disabled={pending || !dialerReady || !versionId || !numberId}
                onClick={() =>
                  run(
                    () =>
                      placeDemoCall({
                        requestId,
                        agentVersionId: versionId,
                        fromNumberId: numberId,
                      }),
                    () => setCalling(false),
                  )
                }
              >
                {pending ? 'جارٍ الاتصال…' : `اتصل بـ ${phone}`}
              </Button>
            </>
          }
        >
          {!dialerReady ? (
            <div className="notice notice--warn" role="status">
              <strong>الاتصال الصادر غير مُهيّأ على هذا الخادم.</strong>
              <p>الطلب محفوظ ويمكن الاتصال يدويًا من هاتفك حتى يُفعَّل المزوّد.</p>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="demo-version">الموظف الصوتي</label>
            <select
              id="demo-version"
              className="input"
              value={versionId}
              onChange={(e) => {
                setVersionId(e.target.value)
                setNumberId('')
              }}
            >
              <option value="">— اختر —</option>
              {versions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="demo-number">الرقم الصادر</label>
            <select
              id="demo-number"
              className="input"
              value={numberId}
              disabled={!versionId}
              onChange={(e) => setNumberId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {eligibleNumbers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.e164}
                </option>
              ))}
            </select>
            {versionId && eligibleNumbers.length === 0 ? (
              <span className="hint">لا يوجد رقم مربوط بنفس نشاط هذا الموظف الصوتي.</span>
            ) : null}
          </div>

          <p className="hint" dir="ltr">
            {phone}
          </p>
        </Sheet>
      ) : null}

      {blocking ? (
        <Sheet
          open
          onClose={() => setBlocking(false)}
          title="حظر دائم"
          description="بلا تاريخ انتهاء، ويوقف كل طلب معلَّق من نفس المصدر فورًا."
          footer={
            <>
              <Button onClick={() => setBlocking(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(
                    () => blockDemoSource(requestId, blockScope, note),
                    () => setBlocking(false),
                  )
                }
              >
                حظر
              </Button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="demo-block-scope">ما الذي يُحظر</label>
            <select
              id="demo-block-scope"
              className="input"
              value={blockScope}
              onChange={(e) => setBlockScope(e.target.value as 'phone' | 'fingerprint')}
            >
              <option value="phone">الرقم نفسه — لن يُتصل به مرة أخرى</option>
              <option value="fingerprint">المصدر — الجهاز والرقم معًا</option>
            </select>
            {/*
              Two scopes because two things go wrong. Blocking a number
              protects whoever owns it; blocking the source stops one
              submitter working through the rate limit with variations.
            */}
            <span className="hint">
              احظر الرقم إذا كان صاحبه طلب عدم الاتصال. احظر المصدر إذا كان الطلب مزيفًا.
            </span>
          </div>
          <div className="field">
            <label htmlFor="demo-block-note">السبب</label>
            <input
              id="demo-block-note"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="طلبات متكررة بأرقام غير حقيقية"
            />
          </div>
        </Sheet>
      ) : null}

      {rejecting ? (
        <Sheet
          open
          onClose={() => setRejecting(false)}
          title="رفض الطلب"
          description="يُغلق الطلب بلا اتصال. اكتب سببًا حتى يُعرف لاحقًا لماذا."
          footer={
            <>
              <Button onClick={() => setRejecting(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setDemoRequestStatus(requestId, 'rejected', note),
                    () => setRejecting(false),
                  )
                }
              >
                رفض
              </Button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="demo-note">السبب</label>
            <textarea
              id="demo-note"
              className="input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="رقم مكرر / بيانات غير حقيقية"
            />
          </div>
        </Sheet>
      ) : null}
    </>
  )
}
