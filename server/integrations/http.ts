import 'server-only'

import { lookup } from 'node:dns/promises'
import { Agent, request } from 'node:https'
import { credentialReference, inspectOutboundUrl, isPrivateAddress } from '@/lib/integrations'
import { revealString } from '@/server/security/protected-data'

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

async function resolvePublicDestination(
  url: URL,
): Promise<{ address: string; family: 4 | 6 } | null> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    return null
  }
  const selected = addresses[0]
  return selected ? { address: selected.address, family: selected.family === 6 ? 6 : 4 } : null
}

function resolveBearer(
  credentialsRef: string | null,
  credentialsEncrypted: string | null,
): { ok: true; value: string | null } | { ok: false } {
  if (credentialsEncrypted) {
    const value = revealString(credentialsEncrypted)
    return value ? { ok: true, value } : { ok: false }
  }
  if (!credentialsRef) return { ok: true, value: null }
  const normalized = credentialReference(credentialsRef)
  if (!normalized) return { ok: false }
  const value = process.env[normalized.slice('env:'.length)]
  return value ? { ok: true, value } : { ok: false }
}

type PinnedResponse =
  | { ok: true; status: number; data: unknown }
  | { ok: false; code: 'network' | 'response'; status: number | null }

function pinnedRequest(input: {
  url: URL
  method: 'GET' | 'POST'
  body?: Record<string, unknown> | undefined
  bearer: string | null
  timeoutMs: number
  destination: { address: string; family: 4 | 6 }
}): Promise<PinnedResponse> {
  const agent = new Agent({
    keepAlive: false,
    lookup(_hostname, options, callback) {
      if (typeof options === 'object' && options.all) {
        callback(null, [input.destination])
        return
      }
      callback(null, input.destination.address, input.destination.family)
    },
  })
  const payload = input.body ? JSON.stringify(input.body) : null

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: PinnedResponse) => {
      if (settled) return
      settled = true
      agent.destroy()
      resolve(result)
    }

    const outgoing = request(
      input.url,
      {
        agent,
        method: input.method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(input.bearer ? { Authorization: `Bearer ${input.bearer}` } : {}),
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        const declared = Number(response.headers['content-length'] ?? 0)
        if (declared > MAX_RESPONSE_BYTES) {
          response.destroy()
          finish({ ok: false, code: 'response', status })
          return
        }

        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += bytes.byteLength
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy()
            finish({ ok: false, code: 'response', status })
            return
          }
          chunks.push(bytes)
        })
        response.on('error', () => finish({ ok: false, code: 'network', status }))
        response.on('end', () => {
          if (settled) return
          try {
            const text = Buffer.concat(chunks).toString('utf8').trim()
            finish({ ok: true, status, data: text ? JSON.parse(text) : null })
          } catch {
            finish({ ok: false, code: 'response', status })
          }
        })
      },
    )
    outgoing.setTimeout(input.timeoutMs, () => outgoing.destroy(new Error('timeout')))
    outgoing.on('error', () => finish({ ok: false, code: 'network', status: null }))
    outgoing.end(payload ?? undefined)
  })
}

export async function safeIntegrationRequest(input: {
  endpoint: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
  credentialsRef: string | null
  credentialsEncrypted?: string | null
  timeoutMs?: number
}): Promise<SafeHttpResult> {
  const started = Date.now()
  const inspected = inspectOutboundUrl(input.endpoint)
  if (!inspected.ok) {
    return { ok: false, code: 'unsafe_url', status: null, latencyMs: Date.now() - started }
  }
  const destination = await resolvePublicDestination(inspected.url)
  if (!destination) {
    return { ok: false, code: 'unsafe_url', status: null, latencyMs: Date.now() - started }
  }

  const bearer = resolveBearer(input.credentialsRef, input.credentialsEncrypted ?? null)
  if (!bearer.ok) {
    return {
      ok: false,
      code: 'credential_missing',
      status: null,
      latencyMs: Date.now() - started,
    }
  }

  const response = await pinnedRequest({
    url: inspected.url,
    method: input.method,
    body: input.body,
    bearer: bearer.value,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    destination,
  })

  const latencyMs = Date.now() - started
  if (!response.ok) {
    return { ok: false, code: response.code, status: response.status, latencyMs }
  }
  if (response.status >= 300 && response.status < 400) {
    return { ok: false, code: 'redirect', status: response.status, latencyMs }
  }
  if (response.status < 200 || response.status >= 300) {
    return { ok: false, code: 'http', status: response.status, latencyMs }
  }
  return { ok: true, status: response.status, latencyMs, data: response.data }
}
