/** Regression checks for data that may enter voice logs or call metadata. */
import {
  maskIdentifier,
  maskNumber,
  sanitizeLogText,
  sanitizeSipHeaders,
} from '../server/voice/log.ts'

let failures = 0

function check(label: string, condition: boolean) {
  if (!condition) failures++
  console.log(`  ${condition ? 'OK' : 'FAIL'} ${label}`)
}

const caller = '+966530047640'
const accountSid = 'AC13b00000000000000000000000aab5'
const callSid = 'CAe3d6000000000000000000000034ec'
const projectId = 'proj_qvhck0iklw9VugSWKTsiTiUk'

const headers = sanitizeSipHeaders([
  { name: 'From', value: `<sip:${caller}@203.0.113.20:5060>` },
  { name: 'To', value: `<sip:${projectId}@sip.api.openai.com;transport=tls>` },
  { name: 'Via', value: 'SIP/2.0/TLS 203.0.113.10:5061;branch=z9hG4bKprivate' },
  { name: 'Call-ID', value: 'private-call-id@203.0.113.20' },
  { name: 'X-Twilio-AccountSid', value: accountSid },
  { name: 'X-Twilio-CallSid', value: callSid },
  { name: 'Authorization', value: 'Bearer never-log-this' },
])

const serialized = JSON.stringify(headers)

console.log('Voice privacy')
check('phone number is masked', maskNumber(caller) === '+966****7640')
check('identifier is masked', maskIdentifier(callSid) === 'CAe3d6****34ec')
check('full caller is absent', !serialized.includes(caller))
check('full account SID is absent', !serialized.includes(accountSid))
check('full call SID is absent', !serialized.includes(callSid))
check('full project ID is absent', !serialized.includes(projectId))
check('SIP hosts are absent', !serialized.includes('203.0.113.20'))
check(
  'transport values are redacted',
  headers.find((h) => h.name === 'Via')?.value === '[redacted]',
)
check(
  'credential values are redacted',
  headers.find((h) => h.name === 'Authorization')?.value === '[redacted]',
)
check(
  'provider error text is sanitized',
  !sanitizeLogText(`${callSid} ${caller}`).includes(callSid),
)

console.log(
  failures === 0 ? '\nAll privacy checks passed' : `\n${failures} privacy check(s) failed`,
)
process.exit(failures === 0 ? 0 : 1)
