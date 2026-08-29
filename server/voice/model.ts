import 'server-only'

const OPENAI_API = 'https://api.openai.com/v1'
const MODEL_PROBE_TTL_MS = 5 * 60 * 1000

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime'

export function realtimeModelCandidates() {
  const configured = process.env.OPENAI_REALTIME_MODEL?.trim()
  return [
    ...new Set(
      [configured, DEFAULT_REALTIME_MODEL].filter((value): value is string => Boolean(value)),
    ),
  ]
}

export const PRIMARY_REALTIME_MODEL = realtimeModelCandidates()[0] ?? DEFAULT_REALTIME_MODEL

export function isRealtimeModelUnavailable(code: string | null, message = '') {
  return (
    code === 'model_not_found' ||
    code === 'openai_http_404' ||
    /model(?:\s+|_)(?:not found|does not exist)|do not have access to model/i.test(message)
  )
}

type ProbeResult = { available: boolean | null; expiresAt: number }
const probeCache = new Map<string, ProbeResult>()

async function probeModel(
  model: string,
  apiKey: string,
  fetcher: typeof fetch,
): Promise<boolean | null> {
  const cached = probeCache.get(model)
  if (cached && cached.expiresAt > Date.now()) return cached.available

  const response = await fetcher(`${OPENAI_API}/models/${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)

  const available = response?.ok
    ? true
    : response?.status === 403 || response?.status === 404
      ? false
      : null
  probeCache.set(model, { available, expiresAt: Date.now() + MODEL_PROBE_TTL_MS })
  return available
}

/**
 * Uses the configured model when this OpenAI project can access it. A stale or
 * unavailable override falls back to the GA Realtime model before a SIP call
 * is accepted, because an accepted call cannot be safely reconfigured after
 * the model rejects the session.
 */
export async function resolveRealtimeModel(apiKey: string, fetcher: typeof fetch = fetch) {
  const candidates = realtimeModelCandidates()
  const configured = candidates[0] ?? DEFAULT_REALTIME_MODEL
  if (configured === DEFAULT_REALTIME_MODEL) return configured

  const available = await probeModel(configured, apiKey, fetcher)
  return available === false ? DEFAULT_REALTIME_MODEL : configured
}
