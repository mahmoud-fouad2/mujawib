import 'server-only'

import { lookup } from 'node:dns/promises'
import { credentialReference, inspectOutboundUrl, isPrivateAddress } from '@/lib/integrations'

const MAX_RESPONSE_BYTES = 256 * 1024
const DEFAULT_TIMEOUT_MS = 8_000

export type SafeHttpResult =
  | { ok: true; status: number; latencyMs: number; data: unknown }
  | {
      ok: false
      code: 'unsafe_url' | 'credential_missing' | 'network' | 'redirect' | 'http' | 'response'
      status: number | null
      latencyMs: number
    }

async function assertPublicDestination(url: URL): Promise<boolean> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address))
}

function resolveBearer(
  credentialsRef: string | null,
): { ok: true; value: string | null } | { ok: false } {
  if (!credentialsRef) return { ok: true, value: null }
  const normalized = credentialReference(credentialsRef)
  if (!normalized) return { ok: false }
  const value = process.env[normalized.slice('env:'.length)]
  return value ? { ok: true, value } : { ok: false }
}

async function readLimitedBody(response: Response): Promise<unknown> {
  if (!response.body || response.status === 204) return null
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_RESPONSE_BYTES) throw new Error('response_too_large')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('response_too_large')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const text = new TextDecoder().decode(bytes).trim()
  if (!text) return null
  return JSON.parse(text)
}

export async function safeIntegrationRequest(input: {
  endpoint: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
  credentialsRef: string | null
  timeoutMs?: number
}): Promise<SafeHttpResult> {
  const started = Date.now()
  const inspected = inspectOutboundUrl(input.endpoint)
  if (!inspected.ok || !(await assertPublicDestination(inspected.url))) {
    return { ok: false, code: 'unsafe_url', status: null, latencyMs: Date.now() - started }
  }

  const bearer = resolveBearer(input.credentialsRef)
  if (!bearer.ok) {
    return {
      ok: false,
      code: 'credential_missing',
      status: null,
      latencyMs: Date.now() - started,
    }
  }

  const response = await fetch(inspected.url, {
    method: input.method,
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      ...(input.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer.value ? { Authorization: `Bearer ${bearer.value}` } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  }).catch(() => null)

  const latencyMs = Date.now() - started
  if (!response) return { ok: false, code: 'network', status: null, latencyMs }
  if (response.status >= 300 && response.status < 400) {
    return { ok: false, code: 'redirect', status: response.status, latencyMs }
  }
  if (!response.ok) return { ok: false, code: 'http', status: response.status, latencyMs }

  try {
    const data = await readLimitedBody(response)
    return { ok: true, status: response.status, latencyMs, data }
  } catch {
    return { ok: false, code: 'response', status: response.status, latencyMs }
  }
}
