import 'server-only'

/**
 * Structured logging for the inbound call path.
 *
 * The first real call is a diagnostic exercise: we do not yet know which SIP
 * header the upstream provider uses to preserve the originally dialled DID, so
 * the log has to show the evidence rather than our assumptions about it.
 *
 * One key per line, greppable in the Render log stream.
 */

export type VoiceStage =
  | 'WEBHOOK_RECEIVED'
  | 'SIGNATURE_VERIFIED'
  | 'SIGNATURE_REJECTED'
  | 'EVENT_IGNORED'
  | 'CALL_ID'
  | 'SIP_HEADERS'
  | 'DID_CANDIDATES'
  | 'PHONE_ROUTE_RESOLVED'
  | 'PHONE_ROUTE_NOT_RESOLVED'
  | 'CLIENT_RESOLVED'
  | 'AGENT_VERSION_RESOLVED'
  | 'ACCEPT_REQUEST_STARTED'
  | 'ACCEPT_RESPONSE_STATUS'
  | 'CALL_ACCEPTED'
  | 'CALL_REJECTED'
  | 'CALL_RECORDED'
  | 'ERROR'

/** Header names whose values may carry personal data or credentials. */
const REDACT = /authorization|proxy-authorization|api-key|secret|token|cookie/i

/**
 * Keeps the last four digits of anything that looks like a phone number.
 * Enough to confirm which DID matched without writing full numbers to logs
 * that a support engineer may later read.
 */
export function maskNumber(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  if (digits.length < 5) return value
  return `${value.slice(0, value.length - digits.length + 1)}…${digits.slice(-4)}`
}

/**
 * SIP headers, with credential-bearing headers dropped entirely.
 *
 * Values are kept intact: the whole point of the first call is to see exactly
 * what the provider sent, and a masked URI would hide the very thing we are
 * trying to identify. Nothing here is a secret — these are routing headers.
 */
export function sanitizeSipHeaders(
  headers: { name: string; value: string }[] | undefined,
): { name: string; value: string }[] {
  if (!headers) return []
  return headers
    .filter((h) => !REDACT.test(h.name))
    .map((h) => ({ name: h.name, value: h.value.slice(0, 400) }))
}

export function voiceLog(stage: VoiceStage, detail?: unknown) {
  const line = `[voice] ${stage}`
  if (detail === undefined) {
    console.log(line)
    return
  }
  if (typeof detail === 'string') {
    console.log(`${line} ${detail}`)
    return
  }
  console.log(`${line} ${JSON.stringify(detail)}`)
}

export function voiceError(stage: VoiceStage, detail: unknown) {
  console.error(`[voice] ${stage} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}
