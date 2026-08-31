export type RealtimeTranscriptAction = {
  kind: 'transcript'
  role: 'caller' | 'agent'
  text: string
  sourceId: string
  eventType: string
  /**
   * Which response this transcript belongs to, when the event carries it.
   *
   * Needed because an agent turn's latency is measured at the moment its audio
   * starts playing, not when its transcript is finished — so the transcript
   * has to be able to find the first-audio timestamp recorded earlier for the
   * same response.
   */
  responseId: string | null
}

export type RealtimeToolAction = {
  kind: 'tool_call'
  toolCallId: string
  name: string
  argumentsJson: string
  sourceId: string
}

export type RealtimeLifecycleAction = {
  kind: 'lifecycle'
  state:
    | 'connected'
    | 'speech_started'
    | 'speech_stopped'
    | 'response_started'
    | 'response_finished'
    /**
     * The caller is now hearing this response. This is the only event that
     * marks first audio, and it is what turn latency is measured to — the
     * previous measurement used `response.output_audio_transcript.done`, which
     * does not fire until the agent has finished the whole reply, so a
     * long answer was recorded as a long latency.
     */
    | 'output_audio_started'
    | 'output_audio_stopped'
  sourceId: string
  responseId: string | null
}

type RealtimeErrorAction = {
  kind: 'error'
  code: string | null
  message: string
  sourceId: string
}

type RealtimeUsageAction = {
  kind: 'usage'
  inputTokens: number
  outputTokens: number
}

export type RealtimeAction =
  | RealtimeTranscriptAction
  | RealtimeToolAction
  | RealtimeLifecycleAction
  | RealtimeErrorAction
  | RealtimeUsageAction

type JsonRecord = Record<string, unknown>

/**
 * Starts an accepted SIP call without waiting for caller speech.
 *
 * The exact brand and agent greeting stays in the published session prompt;
 * this one-response instruction only tells Realtime to speak it now.
 */
/**
 * Whether a freshly opened control socket should make the agent speak.
 *
 * A resumed socket is one attaching to a call that is already in progress —
 * the process that answered it was replaced, and `recoverStaleSidebands`
 * reconnected. Sending the greeting there made the agent restate its opening
 * line in the middle of a conversation, which is the most obviously broken
 * thing a voice agent can do. Only a genuinely new call gets a greeting.
 */
export function shouldSendInitialGreeting(session: { resumed?: boolean }): boolean {
  return session.resumed !== true
}

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
  const eventResponseId = asString(event.response_id)

  if (type === 'session.created' || type === 'session.updated') {
    return [{ kind: 'lifecycle', state: 'connected', sourceId: eventSourceId, responseId: null }]
  }

  if (type === 'input_audio_buffer.speech_started') {
    return [
      { kind: 'lifecycle', state: 'speech_started', sourceId: eventSourceId, responseId: null },
    ]
  }

  if (type === 'input_audio_buffer.speech_stopped') {
    return [
      { kind: 'lifecycle', state: 'speech_stopped', sourceId: eventSourceId, responseId: null },
    ]
  }

  if (type === 'response.created') {
    const response = asRecord(event.response)
    return [
      {
        kind: 'lifecycle',
        state: 'response_started',
        sourceId: eventSourceId,
        responseId: eventResponseId ?? asString(response?.id),
      },
    ]
  }

  if (type === 'output_audio_buffer.started') {
    return [
      {
        kind: 'lifecycle',
        state: 'output_audio_started',
        sourceId: eventSourceId,
        responseId: eventResponseId,
      },
    ]
  }

  if (type === 'output_audio_buffer.stopped') {
    return [
      {
        kind: 'lifecycle',
        state: 'output_audio_stopped',
        sourceId: eventSourceId,
        responseId: eventResponseId,
      },
    ]
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
        responseId: null,
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
        responseId: eventResponseId,
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
    const usage = asRecord(response?.usage)

    const actions: RealtimeAction[] = []

    if (usage) {
      const inputTokens =
        typeof usage.input_tokens === 'number'
          ? usage.input_tokens
          : typeof usage.total_tokens === 'number'
            ? usage.total_tokens
            : 0
      const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0
      if (inputTokens > 0 || outputTokens > 0) {
        actions.push({ kind: 'usage', inputTokens, outputTokens })
      }
    }

    const output = Array.isArray(response?.output) ? response.output : []
    const toolActions = output
      .map((item, index) => {
        const record = asRecord(item)
        return record ? toolAction(record, `${eventSourceId}:${index}`) : null
      })
      .filter((action): action is RealtimeToolAction => Boolean(action))

    actions.push(...toolActions)
    actions.push({
      kind: 'lifecycle',
      state: 'response_finished',
      sourceId: eventSourceId,
      responseId: eventResponseId ?? asString(response?.id),
    })
    return actions
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
