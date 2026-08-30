import { isIP } from 'node:net'
import { z } from 'zod'

const INTEGRATION_ACTIONS = [
  'health',
  'availability',
  'booking',
  'cancellation',
  'reschedule',
  'message',
] as const

export type IntegrationAction = (typeof INTEGRATION_ACTIONS)[number]

export const INTEGRATION_ACTION_LABEL: Record<IntegrationAction, string> = {
  health: 'فحص الاتصال',
  availability: 'قراءة المواعيد',
  booking: 'تثبيت الحجز',
  cancellation: 'إلغاء الحجز',
  reschedule: 'تعديل موعد الحجز',
  message: 'إرسال التأكيد',
}

/**
 * `cancellation`/`reschedule` are deliberately absent from
 * google_calendar/microsoft_365 here even though they support both — this
 * list feeds integrationSetupState's "expected" set below, and every
 * calendar connected before these endpoints existed would suddenly show as
 * missing a required endpoint and flip to not-ready. They stay opt-in
 * extras: configure one and the matching voice tool uses it, don't and
 * nothing regresses.
 */
const PROVIDER_CAPABILITIES: Record<string, IntegrationAction[]> = {
  google_calendar: ['health', 'availability', 'booking'],
  microsoft_365: ['health', 'availability', 'booking'],
  whatsapp: ['health', 'message'],
  rest_api: [...INTEGRATION_ACTIONS],
  generic_api: [...INTEGRATION_ACTIONS],
  hubspot: ['health'],
  zoho: ['health'],
  zoho_crm: ['health'],
  odoo: ['health'],
}

export function capabilitiesForProvider(provider: string): IntegrationAction[] {
  return PROVIDER_CAPABILITIES[provider] ?? ['health']
}

/**
 * Extra actions a provider can support without being required for it — the
 * connection is still `ready` without one configured. Kept separate from
 * PROVIDER_CAPABILITIES for exactly that reason.
 */
const OPTIONAL_PROVIDER_CAPABILITIES: Record<string, IntegrationAction[]> = {
  google_calendar: ['cancellation', 'reschedule'],
  microsoft_365: ['cancellation', 'reschedule'],
}

export function optionalCapabilitiesForProvider(provider: string): IntegrationAction[] {
  return OPTIONAL_PROVIDER_CAPABILITIES[provider] ?? []
}

const endpointSchema = z.string().trim().url().max(2_048)

const integrationConfigSchema = z.object({
  version: z.literal(1).default(1),
  endpoints: z
    .object({
      health: endpointSchema.optional(),
      availability: endpointSchema.optional(),
      booking: endpointSchema.optional(),
      cancellation: endpointSchema.optional(),
      reschedule: endpointSchema.optional(),
      message: endpointSchema.optional(),
    })
    .default({}),
})

export type IntegrationConfig = z.infer<typeof integrationConfigSchema>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Reads the current format and the pre-runtime endpoint fields without mutating data. */
export function normalizeIntegrationConfig(value: unknown): IntegrationConfig {
  const legacy = asRecord(value) ?? {}
  if (legacy.version === 1 || asRecord(legacy.endpoints)) {
    const current = integrationConfigSchema.safeParse(value)
    if (current.success) return current.data
  }

  return {
    version: 1,
    endpoints: {
      ...(optionalString(legacy.testUrl) ? { health: optionalString(legacy.testUrl) } : {}),
      ...(optionalString(legacy.availabilityUrl)
        ? { availability: optionalString(legacy.availabilityUrl) }
        : {}),
      ...(optionalString(legacy.bookingUrl) ? { booking: optionalString(legacy.bookingUrl) } : {}),
      ...(optionalString(legacy.sendUrl) ? { message: optionalString(legacy.sendUrl) } : {}),
    },
  }
}

function configuredActions(config: IntegrationConfig): IntegrationAction[] {
  return INTEGRATION_ACTIONS.filter((action) => Boolean(config.endpoints[action]))
}

export function credentialReference(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/^env:/, '')
  return /^[A-Z][A-Z0-9_]{2,80}$/.test(normalized) ? `env:${normalized}` : null
}

export type OutboundUrlIssue =
  | 'invalid_url'
  | 'https_required'
  | 'credentials_forbidden'
  | 'port_forbidden'
  | 'private_host'

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  const [a, b] = octets
  if (octets.length !== 4 || a === undefined || b === undefined) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version !== 6) return true

  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('2001:db8:')) return true
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true
  }
  return false
}

/** Fast validation used both by the save form and before DNS resolution. */
export function inspectOutboundUrl(
  value: string,
): { ok: true; url: URL } | { ok: false; issue: OutboundUrlIssue } {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, issue: 'invalid_url' }
  }

  if (url.protocol !== 'https:') return { ok: false, issue: 'https_required' }
  if (url.username || url.password) return { ok: false, issue: 'credentials_forbidden' }
  if (url.port && url.port !== '443') return { ok: false, issue: 'port_forbidden' }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const blockedName =
    hostname === 'localhost' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home')
  if (blockedName || (isIP(hostname) > 0 && isPrivateAddress(hostname))) {
    return { ok: false, issue: 'private_host' }
  }

  return { ok: true, url }
}

export function integrationSetupState(input: {
  provider: string
  config: IntegrationConfig
  credentialsRef: string | null
  hasStoredCredential?: boolean
}) {
  const expected = capabilitiesForProvider(input.provider).filter((action) => action !== 'health')
  const configured = configuredActions(input.config)
  const missing = expected.filter((action) => !configured.includes(action))
  const credentialValid =
    input.hasStoredCredential === true ||
    !input.credentialsRef ||
    Boolean(credentialReference(input.credentialsRef))

  return {
    expected,
    configured,
    missing,
    credentialValid,
    ready: missing.length === 0 && credentialValid && configured.length > 0,
  }
}
