import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/legal-page'
import { SiteShell } from '@/components/site/site-shell'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  locale: 'en',
  path: '/terms',
  title: 'Terms of use',
  description: 'The terms under which Mujawib runs voice reception for your business.',
})

export default function EnglishTermsPage() {
  return (
    <SiteShell locale="en">
      <LegalPage
        locale="en"
        eyebrow="Terms"
        title="The agreement between us."
        lead="What we commit to, what we ask of you, and how either side can end it."
        updated="August 2026"
        sections={[
          {
            heading: 'What the service is',
            body: [
              'Mujawib is a managed service: our team builds the voice agent, tests it and publishes it, while you watch the results and request changes through the portal.',
              'There is no self-signup. An account is opened once the scope of work is agreed.',
            ],
          },
          {
            heading: 'What we commit to',
            body: [
              'To run the service as agreed, to tell you about any outage affecting your inbound calls, and to keep a fallback path that routes the call to your team rather than dropping it.',
              'Every change to the agent’s behaviour clears a test before it is published, and can be rolled back.',
            ],
          },
          {
            heading: 'What we ask of you',
            body: [
              'That you own the number connected to the service or are authorised to use it, and that you comply with the telecoms and data-protection rules in your country — including notifying callers about recording where it is enabled.',
              'That you keep your team’s sign-in credentials confidential, and tell us immediately about any unauthorised access.',
            ],
          },
          {
            heading: 'Limits of liability',
            body: [
              'The voice agent is an operational tool, not a substitute for professional advice. It gives no medical, legal or financial advice, and takes no decision on your business’s behalf beyond what your own settings permit.',
              'We are not liable for indirect damages, and our liability is capped at the value of the subscription over the period in dispute.',
            ],
          },
          {
            heading: 'Pricing and billing',
            body: [
              'The subscription is calculated on calls handled, as set out in your quote. Any price change is communicated 30 days before it takes effect.',
            ],
          },
          {
            heading: 'Ending the agreement',
            body: [
              'Either side may end the agreement with 30 days’ notice. On termination we hand you a copy of your data and then delete it in line with the agreed retention policy.',
            ],
          },
        ]}
      />
    </SiteShell>
  )
}
