import type { Metadata } from 'next'
import { PageHead, Section } from '@/components/console/ui'
import { PhoneProvisioningClient } from '@/components/portal/phone-provisioning'

export const metadata: Metadata = {
  title: 'الأرقام | بوابة العميل',
}

export default async function PhoneProvisioningPage() {
  return (
    <>
      <PageHead
        title="أرقام الاتصال"
        sub="اختر واستأجر رقماً هاتفياً مخصصاً لاستقبال مكالمات عملائك."
      />

      <Section title="البحث والاستئجار">
        <PhoneProvisioningClient />
      </Section>
    </>
  )
}
