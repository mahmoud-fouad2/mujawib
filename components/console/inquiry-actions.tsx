'use client'

import { CheckCircle2, CircleDot, FileText, Trophy, XCircle } from 'lucide-react'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { updateSalesInquiryStatus } from '@/server/actions/console'

const STATUSES = [
  { value: 'new', label: 'جديد', icon: CircleDot },
  { value: 'qualified', label: 'مؤهل', icon: CheckCircle2 },
  { value: 'proposal', label: 'عُرضت الخطة', icon: FileText },
  { value: 'won', label: 'تحول إلى عميل', icon: Trophy },
  { value: 'lost', label: 'لم يستمر', icon: XCircle },
] as const

export function InquiryActions({ inquiryId, status }: { inquiryId: string; status: string }) {
  const { run, pending } = useAction()
  return (
    <RowActions label="تغيير حالة الطلب">
      {STATUSES.map((item) => {
        const Icon = item.icon
        return (
          <RowAction
            key={item.value}
            icon={<Icon size={15} />}
            disabled={pending || status === item.value}
            onClick={() => run(() => updateSalesInquiryStatus({ inquiryId, status: item.value }))}
          >
            {item.label}
          </RowAction>
        )
      })}
    </RowActions>
  )
}
