import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHead, Section } from '@/components/console/ui'
import { PhoneProvisioningClient } from '@/components/portal/phone-provisioning'
import { EmptyState } from '@/components/ui/primitives'
import { canClient } from '@/lib/access'
import { getPortalWorkspace } from '@/server/data/portal'

export const metadata: Metadata = { title: 'الأرقام | بوابة العميل' }
export const dynamic = 'force-dynamic'

export default async function PhoneProvisioningPage() {
  const workspace = await getPortalWorkspace()
  if (!workspace) notFound()

  const canRequest = canClient(workspace.accessRole, 'phone.request')

  return (
    <>
      <PageHead
        title="أرقام الاتصال"
        sub="اطلب رقمًا مخصصًا لاستقبال مكالمات عملائك — الشراء الفعلي يحتاج اعتماد فريق التشغيل."
      />

      <Section title="البحث والطلب">
        {canRequest ? (
          <PhoneProvisioningClient workspaceId={workspace.id} />
        ) : (
          <EmptyState title="لا تملك صلاحية طلب رقم" body="تواصل مع مدير حسابكم لطلب رقم جديد." />
        )}
      </Section>
    </>
  )
}
