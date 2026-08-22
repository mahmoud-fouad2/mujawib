import {
  credentialReference,
  inspectOutboundUrl,
  integrationSetupState,
  normalizeIntegrationConfig,
} from '../lib/integrations.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(
      `      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`,
    )
  }
}

console.log('Configuration compatibility')
check(
  'legacy endpoint fields are normalized',
  normalizeIntegrationConfig({
    testUrl: 'https://api.example.com/health',
    bookingUrl: 'https://api.example.com/bookings',
    sendUrl: 'https://api.example.com/messages',
  }),
  {
    version: 1,
    endpoints: {
      health: 'https://api.example.com/health',
      booking: 'https://api.example.com/bookings',
      message: 'https://api.example.com/messages',
    },
  },
)
check(
  'current format remains unchanged',
  normalizeIntegrationConfig({
    version: 1,
    endpoints: { availability: 'https://api.example.com/availability' },
  }),
  {
    version: 1,
    endpoints: { availability: 'https://api.example.com/availability' },
  },
)

console.log('\nOutbound URL policy')
for (const [label, url, issue] of [
  ['HTTP is rejected', 'http://api.example.com/health', 'https_required'],
  ['localhost is rejected', 'https://localhost/health', 'private_host'],
  ['loopback IPv4 is rejected', 'https://127.0.0.1/health', 'private_host'],
  ['private IPv4 is rejected', 'https://10.0.0.5/health', 'private_host'],
  ['metadata IP is rejected', 'https://169.254.169.254/latest', 'private_host'],
  ['loopback IPv6 is rejected', 'https://[::1]/health', 'private_host'],
  ['URL credentials are rejected', 'https://user:pass@api.example.com', 'credentials_forbidden'],
  ['custom ports are rejected', 'https://api.example.com:8443/health', 'port_forbidden'],
] as const) {
  const result = inspectOutboundUrl(url)
  check(label, result.ok ? 'accepted' : result.issue, issue)
}
check(
  'public HTTPS endpoint is accepted',
  inspectOutboundUrl('https://api.example.com/health').ok,
  true,
)

console.log('\nCredential references')
check(
  'environment reference is normalized',
  credentialReference('env:CLIENT_CALENDAR_TOKEN'),
  'env:CLIENT_CALENDAR_TOKEN',
)
check(
  'plain environment name is normalized',
  credentialReference('CLIENT_CALENDAR_TOKEN'),
  'env:CLIENT_CALENDAR_TOKEN',
)
check('secret values are rejected', credentialReference('sk-live-secret'), null)
check('legacy secret URI is rejected', credentialReference('secret://client/calendar'), null)

console.log('\nOperational readiness')
check(
  'calendar requires availability and booking',
  integrationSetupState({
    provider: 'google_calendar',
    config: normalizeIntegrationConfig({
      version: 1,
      endpoints: { health: 'https://api.example.com/health' },
    }),
    credentialsRef: null,
  }).missing,
  ['availability', 'booking'],
)
check(
  'configured calendar is ready',
  integrationSetupState({
    provider: 'google_calendar',
    config: normalizeIntegrationConfig({
      version: 1,
      endpoints: {
        availability: 'https://api.example.com/availability',
        booking: 'https://api.example.com/bookings',
      },
    }),
    credentialsRef: 'env:CLIENT_CALENDAR_TOKEN',
  }).ready,
  true,
)

if (failures > 0) {
  console.error(`\n${failures} integration contract check(s) failed.`)
  process.exit(1)
}

console.log('\nAll integration contract checks passed.')
