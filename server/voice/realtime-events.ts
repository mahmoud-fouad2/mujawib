export type RealtimeTranscriptAction = {
  kind: 'transcript'
  role: 'caller' | 'agent'
  text: string
  sourceId: string
  eventType: string
}

export type RealtimeToolAction = {
  kind: 'tool_call'
  toolCallId: string
  name: string
  argumentsJson: string
  sourceId: string
}

type RealtimeLifecycleAction = {
  kind: 'lifecycle'
  state: 'connected' | 'speech_started' | 'speech_stopped'
  sourceId: string
}

type RealtimeErrorAction = {
  kind: 'error'
  code: string | null
  message: string
  sourceId: string
}

export type RealtimeAction =
  | RealtimeTranscriptAction
  | RealtimeToolAction
  | RealtimeLifecycleAction
  | RealtimeErrorAction

type JsonRecord = Record<string, unknown>

/**
 * Starts an accepted SIP call without waiting for caller speech.
 *
 * The exact brand and agent greeting stays in the published session prompt;
 * this one-response instruction only tells Realtime to speak it now.
 */
export function initialGreetingEvent() {
  return {
    type: 'response.create',
    response: {
      instructions:
        'ابدأ المكالمة الآن بجملة الافتتاح المحددة في تعليمات الجلسة، ثم انتظر رد المتصل. لا تضف شرحًا ولا تسأل أكثر من سؤال واحد.',
    },
  } as const
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sourceId(event: JsonRecord, fallback: string): string {
  return (
    asString(event.event_id) ?? asString(event.item_id) ?? asString(event.response_id) ?? fallback
  )
}

function toolAction(item: JsonRecord, fallbackSourceId: string): RealtimeToolAction | null {
  if (item.type !== 'function_call') return null

  const toolCallId = asString(item.call_id)
  const name = asString(item.name)
  const argumentsJson = asString(item.arguments) ?? '{}'
  if (!toolCallId || !name) return null

  return {
    kind: 'tool_call',
    toolCallId,
    name,
    argumentsJson,
    sourceId: asString(item.id) ?? fallbackSourceId,
  }
}

/**
 * Converts the small subset of Realtime server events MUJAWIB owns into a
 * stable internal contract. Unknown events are deliberately ignored; raw
 * provider payloads never leak into the database or operator UI.
 */
export function actionsFromRealtimeEvent(value: unknown): RealtimeAction[] {
  const event = asRecord(value)
  const type = asString(event?.type)
  if (!event || !type) return []

  const eventSourceId = sourceId(event, type)

  if (type === 'session.created' || type === 'session.updated') {
    return [{ kind: 'lifecycle', state: 'connected', sourceId: eventSourceId }]
  }

  if (type === 'input_audio_buffer.speech_started') {
    return [{ kind: 'lifecycle', state: 'speech_started', sourceId: eventSourceId }]
  }

  if (type === 'input_audio_buffer.speech_stopped') {
    return [{ kind: 'lifecycle', state: 'speech_stopped', sourceId: eventSourceId }]
  }

  if (
    type === 'conversation.item.input_audio_transcription.completed' ||
    type === 'input_audio_transcription.completed'
  ) {
    const text = asString(event.transcript)
    if (!text) return []
    return [
      {
        kind: 'transcript',
        role: 'caller',
        text,
        sourceId: sourceId(event, `${type}:${text}`),
        eventType: type,
      },
    ]
  }

  if (type === 'response.output_audio_transcript.done' || type === 'response.output_text.done') {
    const text = asString(event.transcript) ?? asString(event.text)
    if (!text) return []
    return [
      {
        kind: 'transcript',
        role: 'agent',
        text,
        sourceId: sourceId(event, `${type}:${text}`),
        eventType: type,
      },
    ]
  }

  if (type === 'response.function_call_arguments.done') {
    const toolCallId = asString(event.call_id)
    const name = asString(event.name)
    if (!toolCallId || !name) return []
    return [
      {
        kind: 'tool_call',
        toolCallId,
        name,
        argumentsJson: asString(event.arguments) ?? '{}',
        sourceId: eventSourceId,
      },
    ]
  }

  if (type === 'response.output_item.done') {
    const item = asRecord(event.item)
    const action = item ? toolAction(item, eventSourceId) : null
    return action ? [action] : []
  }

  if (type === 'response.done') {
    const response = asRecord(event.response)
    const output = Array.isArray(response?.output) ? response.output : []
    return output
      .map((item, index) => {
        const record = asRecord(item)
        return record ? toolAction(record, `${eventSourceId}:${index}`) : null
      })
      .filter((action): action is RealtimeToolAction => Boolean(action))
  }

  if (type === 'error') {
    const error = asRecord(event.error)
    return [
      {
        kind: 'error',
        code: asString(error?.code),
        message: asString(error?.message) ?? 'Realtime session error',
        sourceId: eventSourceId,
      },
    ]
  }

  return []
}
