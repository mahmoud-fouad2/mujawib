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
  | 'RATE_LIMITED'
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
  | 'REALTIME_MODEL_FALLBACK'
  | 'ACCEPT_REQUEST_STARTED'
  | 'ACCEPT_RESPONSE_STATUS'
  | 'CALL_ACCEPTED'
  | 'CALL_REJECTED'
  | 'CALL_RECORDED'
  | 'PHONE_STATE'
  | 'SIDEBAND_CONNECTING'
  | 'SIDEBAND_CONNECTED'
  | 'GREETING_REQUESTED'
  | 'SIDEBAND_CLOSED'
  | 'SIDEBAND_ERROR'
  | 'TOOL_CALL_STARTED'
  | 'TOOL_CALL_COMPLETED'
  | 'POST_CALL_COMPLETED'
  | 'POST_CALL_FAILED'
  | 'RECORDING_READY'
  | 'RECORDING_FAILED'
  | 'RECORDING_EVENT_FAILED'
  | 'LATENCY_MEASURED'
  | 'ERROR'

/** Header values that must never reach logs or persisted diagnostic metadata. */
const REDACT_VALUE = /authorization|proxy-authorization|api-key|secret|token|cookie/i
const REDACT_INFRASTRUCTURE = /^(call-id|contact|record-route|route|via)$/i
const PHONE_LIKE = /\+?\d[\d\s().-]{5,}\d/g
const SID_LIKE = /\b(?:AC|CA)[A-Za-z0-9]{8,}\b/g
const PROJECT_LIKE = /\bproj_[A-Za-z0-9]+\b/g

/**
 * Keeps the last four digits of anything that looks like a phone number.
 * Enough to confirm which DID matched without writing full numbers to logs
 * that a support engineer may later read.
 */
export function maskNumber(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) return '****'
  const prefixLength = Math.min(value.trim().startsWith('+') ? 3 : 2, digits.length - 4)
  const plus = value.trim().startsWith('+') ? '+' : ''
  return `${plus}${digits.slice(0, prefixLength)}****${digits.slice(-4)}`
}

/** Keeps an identifier useful for correlation without exposing it in full. */
export function maskIdentifier(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 10) return '****'
  return `${value.slice(0, 6)}****${value.slice(-4)}`
}

/** Sanitizes provider/API text before it is written to a diagnostic log. */
export function sanitizeLogText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(SID_LIKE, (identifier) => maskIdentifier(identifier))
    .replace(PROJECT_LIKE, (identifier) => maskIdentifier(identifier))
    .replace(PHONE_LIKE, (number) => maskNumber(number))
    .replace(/@[A-Za-z0-9.-]+(?::\d+)?/g, '@[sip-host]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[sip-host]')
    .slice(0, 400)
}

/**
 * SIP headers safe enough for logs and call metadata. Header names remain so
 * Ops can prove which shape arrived, but credentials, infrastructure routes,
 * provider SIDs, project IDs, hosts, and phone numbers are never kept in full.
 */
export function sanitizeSipHeaders(
  headers: { name: string; value: string }[] | undefined,
): { name: string; value: string }[] {
  if (!headers) return []
  return headers.map((header) => {
    const name = header.name
      .replace(/[\r\n\t]+/g, '')
      .trim()
      .slice(0, 80)
    if (REDACT_VALUE.test(name) || REDACT_INFRASTRUCTURE.test(name)) {
      return { name, value: '[redacted]' }
    }
    return { name, value: sanitizeLogText(header.value) }
  })
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
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail)
  console.error(`[voice] ${stage} ${text}`)
  // `text` reaching here has already been through sanitizeLogText/maskNumber
  // at every call site that carries provider data — the same string that was
  // already safe enough for the Render log stream is safe enough for Sentry.
  // A no-op when SENTRY_DSN is unset, same as every other optional integration.
  void reportVoiceError(stage, text)
}

async function reportVoiceError(stage: VoiceStage, text: string) {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureMessage(`[voice] ${stage} ${text}`, 'error')
  } catch {
    // Sentry itself must never be why a call fails.
  }
}
