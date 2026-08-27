import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/legal-page'
import { SiteShell } from '@/components/site/site-shell'
import { CONTACT } from '@/lib/content/contact'
import { breadcrumbSchema, JsonLd, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/privacy',
  title: 'Privacy Policy & Data Protection | Mujawib',
  description: 'How Mujawib handles your call data and your callers’ data securely.',
})

export default function EnglishPrivacyPage() {
  return (
    <SiteShell locale="en">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/en' },
            { name: 'Privacy Policy', path: '/en/privacy' },
          ]),
        ]}
      />
      <LegalPage
        locale="en"
        eyebrow="Privacy"
        title="Your data, and your callers’ data."
        lead="What we hold, why we hold it, how long we keep it, and the control you have over all of it."
        updated="August 2026"
        sections={[
          {
            heading: 'What we store',
            body: [
              'We store the call record: the caller’s number, the time and length of the call, the transcript, and the actions carried out during it such as a booking or a transfer. This is what you see in the console.',
              'Voice recording is optional and enabled per business after that business agrees to it, because recording law differs from country to country.',
            ],
          },
          {
            heading: 'Who the data belongs to',
            body: [
              'Your call data belongs to your business. We process it on your behalf to run the service, and never sell it or share it with an advertising party.',
              'We do not use your call content to train AI models.',
            ],
          },
          {
            heading: 'Isolation between clients',
            body: [
              'Every business has its own workspace. A user in one business cannot reach another business’s calls or data, and permissions inside your own business follow each person’s role.',
            ],
          },
          {
            heading: 'Retention',
            body: [
              'Your business sets how long call records, transcripts and recordings are kept. The default is 180 days for records and transcripts, and 30 days for recordings where they are enabled.',
              'Data is deleted automatically once the period ends. You can also ask us to delete any record earlier.',
            ],
          },
          {
            heading: 'Connection credentials',
            body: [
              'Credentials for your systems — calendar, WhatsApp, CRM — are stored encrypted and appear in no interface, including the ones our own operations team uses.',
            ],
          },
          {
            heading: 'Your rights',
            body: [
              `At any point you can ask for a copy of your data, have it corrected or deleted, or stop the service and take your data with you. Write to ${CONTACT.email} and we will respond within 30 days at the latest.`,
            ],
          },
        ]}
      />
    </SiteShell>
  )
}
