import { z } from 'zod'

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable()

/**
 * The only model-authored object that may be persisted after a call. Business
 * outcomes remain database evidence; this object is an operational reading of
 * the conversation, not permission to claim that an action succeeded.
 */
export const generatedCallSummarySchema = z
  .object({
    headline: z.string().trim().min(1).max(120),
    callerNeed: nullableText(360),
    resolution: z.string().trim().min(1).max(500),
    nextAction: nullableText(360),
    intent: nullableText(120),
    urgency: z.enum(['low', 'medium', 'high']),
    followUpRequired: z.boolean(),
  })
  .strict()

export type GeneratedCallSummary = z.infer<typeof generatedCallSummarySchema>

export const CALL_SUMMARY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', minLength: 1, maxLength: 120 },
    callerNeed: { type: ['string', 'null'], maxLength: 360 },
    resolution: { type: 'string', minLength: 1, maxLength: 500 },
    nextAction: { type: ['string', 'null'], maxLength: 360 },
    intent: { type: ['string', 'null'], maxLength: 120 },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    followUpRequired: { type: 'boolean' },
  },
  required: [
    'headline',
    'callerNeed',
    'resolution',
    'nextAction',
    'intent',
    'urgency',
    'followUpRequired',
  ],
} as const

const usageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict()

const commonState = {
  schemaVersion: z.literal(1),
  model: z.string().min(1).max(100),
  transcriptHash: z.string().regex(/^[a-f0-9]{64}$/),
  attempt: z.number().int().positive(),
}

export const callIntelligenceStateSchema = z.discriminatedUnion('state', [
  z
    .object({
      ...commonState,
      state: z.literal('processing'),
      startedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      ...commonState,
      state: z.literal('completed'),
      generatedAt: z.string().datetime(),
      responseId: z.string().min(1).max(160).nullable(),
      usage: usageSchema.nullable(),
    })
    .strict(),
  z
    .object({
      ...commonState,
      state: z.literal('failed'),
      failedAt: z.string().datetime(),
      errorCode: z.enum([
        'not_configured',
        'request_failed',
        'request_timeout',
        'incomplete_response',
        'refused',
        'invalid_response',
      ]),
    })
    .strict(),
  z
    .object({
      ...commonState,
      state: z.literal('skipped'),
      skippedAt: z.string().datetime(),
      reason: z.enum(['missing_transcript', 'call_not_finished', 'demo_record']),
    })
    .strict(),
])

export type CallIntelligenceState = z.infer<typeof callIntelligenceStateSchema>
export type CallIntelligenceView = CallIntelligenceState | { state: 'not_started' }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readCallIntelligenceState(metadata: unknown): CallIntelligenceView {
  const record = asRecord(metadata)
  const parsed = callIntelligenceStateSchema.safeParse(record?.postCall)
  return parsed.success ? parsed.data : { state: 'not_started' }
}

type ResponseUsage = { inputTokens: number; outputTokens: number } | null

export type ParsedSummaryResponse =
  | {
      ok: true
      summary: GeneratedCallSummary
      responseId: string | null
      usage: ResponseUsage
    }
  | {
      ok: false
      code: 'incomplete_response' | 'refused' | 'invalid_response'
    }

/** Parse the REST response defensively without depending on SDK-only helpers. */
export function parseCallSummaryResponse(value: unknown): ParsedSummaryResponse {
  const response = asRecord(value)
  if (response?.status !== 'completed') {
    return { ok: false, code: 'incomplete_response' }
  }

  let outputText: string | null = null
  for (const output of Array.isArray(response.output) ? response.output : []) {
    const message = asRecord(output)
    if (message?.type !== 'message') continue
    for (const part of Array.isArray(message.content) ? message.content : []) {
      const content = asRecord(part)
      if (content?.type === 'refusal') return { ok: false, code: 'refused' }
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        outputText = content.text
      }
    }
  }

  if (!outputText) return { ok: false, code: 'invalid_response' }

  try {
    const summary = generatedCallSummarySchema.safeParse(JSON.parse(outputText))
    if (!summary.success) return { ok: false, code: 'invalid_response' }

    const rawUsage = asRecord(response.usage)
    const inputTokens = rawUsage?.input_tokens
    const outputTokens = rawUsage?.output_tokens
    const usage =
      typeof inputTokens === 'number' &&
      Number.isInteger(inputTokens) &&
      inputTokens >= 0 &&
      typeof outputTokens === 'number' &&
      Number.isInteger(outputTokens) &&
      outputTokens >= 0
        ? { inputTokens, outputTokens }
        : null

    return {
      ok: true,
      summary: summary.data,
      responseId: typeof response.id === 'string' ? response.id.slice(0, 160) : null,
      usage,
    }
  } catch {
    return { ok: false, code: 'invalid_response' }
  }
}
