'use client'

import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Confirm } from '@/components/ui/overlays'
import { useAction } from '@/components/ui/row-actions'
import { relative } from '@/lib/format'
import { approvePhoneNumberPurchase, rejectPhoneNumberPurchase } from '@/server/actions/twilio'

export type PendingPhoneRequest = {
  id: string
  workspaceId: string
  title: string
  description: string | null
  createdAt: Date
  metadata: Record<string, unknown> | null
}

function RequestRow({ request }: { request: PendingPhoneRequest }) {
  const [rejecting, setRejecting] = useState(false)
  const { run, pending } = useAction()
  const meta = (request.metadata ?? {}) as {
    e164Number?: string
    friendlyName?: string
    lastError?: string
  }

  return (
    <>
      <tr>
        <td className="mono" dir="ltr" style={{ fontWeight: 500 }}>
          {meta.e164Number ?? request.title}
        </td>
        <td className="muted">{request.description ?? '—'}</td>
        <td className="muted">{relative(request.createdAt)}</td>
        {meta.lastError ? (
          <td className="muted" style={{ color: 'var(--bad)' }}>
            {meta.lastError}
          </td>
        ) : (
          <td className="muted">—</td>
        )}
        <td>
          <div className="cluster">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => approvePhoneNumberPurchase(request.id))}
            >
              <Check size={14} aria-hidden="true" />
              اعتمد وابدأ الشراء
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              <X size={14} aria-hidden="true" />
              ارفض
            </Button>
          </div>
        </td>
      </tr>
      <Confirm
        open={rejecting}
        onClose={() => setRejecting(false)}
        onConfirm={() =>
          run(
            () => rejectPhoneNumberPurchase(request.id),
            () => setRejecting(false),
          )
        }
        title={`رفض طلب ${meta.e164Number ?? request.title}؟`}
        body="سيُعلم العميل برفض الطلب. يمكنه تقديم طلب جديد لاحقًا."
        confirmLabel="ارفض الطلب"
        tone="danger"
        pending={pending}
      />
    </>
  )
}

/**
 * Money only moves from here — never from the client's own click in
 * /portal/phone. "اعتمد وابدأ الشراء" is the one button in the product that
 * triggers a real Twilio purchase; everything before it is a request record.
 */
export function PendingPhoneRequestsSection({ requests }: { requests: PendingPhoneRequest[] }) {
  if (requests.length === 0) return null

  return (
    <div className="table-scroll">
      <table className="table table--rows">
        <thead>
          <tr>
            <th>الرقم</th>
            <th>الموقع</th>
            <th>طُلب</th>
            <th>آخر خطأ</th>
            <th aria-label="إجراءات" />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
