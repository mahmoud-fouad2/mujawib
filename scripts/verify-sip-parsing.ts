/**
 * Checks the SIP header parsing that decides which DID a call arrived on.
 *
 *   pnpm voice:verify-sip
 *
 * Pure functions only — no database. The point is that the parser stays
 * header-agnostic: the ingress provider may preserve the originally dialled
 * number in `To`, `Diversion`, `P-Called-Party-ID` or something else, and the
 * resolver must surface every candidate rather than assume one.
 */
import { callerFrom, didCandidates, toE164 } from '../server/voice/sip.ts'

const DID = '+16513711782'
const CALLER = '+966530047640'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok)
    console.log(
      `      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`,
    )
}

console.log('E.164 normalisation')
check('spaced international', toE164('+1 651 371 1782'), DID)
check('punctuated', toE164('+1 (651) 371-1782'), DID)
check('no plus stays bare', toE164('16513711782'), '16513711782')
check('too short is rejected', toE164('4576'), null)
check('non-numeric is rejected', toE164('reception'), null)

console.log('\nDID discovery across header shapes')

const shapes: { label: string; headers: { name: string; value: string }[]; expect: string[] }[] = [
  {
    label: 'DID in To',
    headers: [
      { name: 'To', value: `<sip:${DID}@sip.api.openai.com>` },
      { name: 'From', value: '"Caller" <sip:+201234567890@provider.example>' },
    ],
    expect: ['To'],
  },
  {
    label: 'To is the project, DID in Diversion',
    headers: [
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'Diversion', value: `<sip:${DID}@provider.example>;reason=unconditional` },
    ],
    expect: ['Diversion'],
  },
  {
    label: 'DID in P-Called-Party-ID without a plus',
    headers: [
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'P-Called-Party-ID', value: '<sip:16513711782@provider.example;user=phone>' },
    ],
    expect: ['P-Called-Party-ID'],
  },
  {
    label: 'no DID present at all',
    headers: [
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
      { name: 'From', value: '<sip:+201234567890@provider.example>' },
    ],
    expect: [],
  },
  {
    label: 'caller identity is never a DID candidate',
    headers: [
      { name: 'From', value: `<sip:${DID}@provider.example>` },
      { name: 'P-Asserted-Identity', value: `<tel:${DID}>` },
      { name: 'To', value: '<sip:proj_abc123@sip.api.openai.com>' },
    ],
    expect: [],
  },
]

for (const shape of shapes) {
  const candidates = didCandidates(shape.headers)
  const matching = candidates.filter((c) => c.e164 === DID).map((c) => c.header)
  check(shape.label, matching, shape.expect)
}

console.log('\nSuccessful real-call regression fixture')
const successfulIngressHeaders = [
  { name: 'Record-Route', value: '<sip:198.51.100.20:5061;transport=tls;lr>' },
  { name: 'From', value: `<sip:${CALLER}@198.51.100.21:5060>` },
  { name: 'To', value: '<sip:proj_fixture@sip.api.openai.com;transport=tls>' },
  { name: 'P-Asserted-Identity', value: `<sip:${CALLER}@198.51.100.21:5060>` },
  { name: 'Diversion', value: `<sip:${DID}@198.51.100.21>;reason=unconditional` },
  { name: 'Call-ID', value: 'fixture-call-id@198.51.100.21' },
  { name: 'Via', value: 'SIP/2.0/TLS 198.51.100.20:5061;branch=z9hG4bKfixture' },
  { name: 'Contact', value: `<sip:${CALLER}@198.51.100.21:5060>` },
  { name: 'X-Twilio-AccountSid', value: 'AC13b00000000000000000000000aab5' },
  { name: 'User-Agent', value: 'Twilio Gateway' },
  { name: 'X-Twilio-CallSid', value: 'CAe3d6000000000000000000000034ec' },
]

check(
  'business DID resolves from Diversion only',
  didCandidates(successfulIngressHeaders).map(({ header, e164 }) => ({ header, e164 })),
  [{ header: 'Diversion', e164: DID }],
)
check('caller remains caller identity', callerFrom(successfulIngressHeaders), CALLER)

console.log('\nCaller extraction')
check(
  'From header',
  callerFrom([{ name: 'From', value: '"X" <sip:+201234567890@provider.example>' }]),
  '+201234567890',
)
check('missing From', callerFrom([{ name: 'To', value: '<sip:x@y>' }]), null)

console.log(failures === 0 ? '\n✓ all checks passed' : `\n✗ ${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
