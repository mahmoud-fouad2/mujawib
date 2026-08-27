export type RecordingRealtimeAction =
  | { kind: 'caller_boundary'; boundary: 'start' | 'end'; itemId: string; atMs: number }
  | { kind: 'retrieve_caller_audio'; itemId: string }
  | { kind: 'caller_audio'; itemId: string; audioBase64: string }
  | { kind: 'agent_audio_delta'; responseId: string; audioBase64: string }
  | {
      kind: 'agent_playback'
      responseId: string
      state: 'started' | 'stopped' | 'cleared'
    }

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function userAudioItem(event: JsonRecord) {
  const item = asRecord(event.item)
  const itemId = asString(item?.id)
  if (!item || !itemId || item.role !== 'user' || !Array.isArray(item.content)) return null
  const audioPart = item.content
    .map(asRecord)
    .find((content) => content?.type === 'input_audio' || content?.type === 'audio')
  return audioPart ? { itemId, audioPart } : null
}

export function recordingActionsFromRealtimeEvent(value: unknown): RecordingRealtimeAction[] {
  const event = asRecord(value)
  const type = asString(event?.type)
  if (!event || !type) return []

  if (
    type === 'input_audio_buffer.speech_started' ||
    type === 'input_audio_buffer.speech_stopped'
  ) {
    const itemId = asString(event.item_id)
    const boundary = type.endsWith('speech_started') ? 'start' : 'end'
    const atMs = asFiniteNumber(boundary === 'start' ? event.audio_start_ms : event.audio_end_ms)
    return itemId && atMs !== null ? [{ kind: 'caller_boundary', boundary, itemId, atMs }] : []
  }

  if (type === 'conversation.item.created') {
    const item = userAudioItem(event)
    return item ? [{ kind: 'retrieve_caller_audio', itemId: item.itemId }] : []
  }

  if (type === 'conversation.item.input_audio_transcription.completed') {
    const itemId = asString(event.item_id)
    return itemId ? [{ kind: 'retrieve_caller_audio', itemId }] : []
  }

  if (type === 'conversation.item.retrieved') {
    const item = userAudioItem(event)
    const audioBase64 = asString(item?.audioPart.audio)
    return item && audioBase64 ? [{ kind: 'caller_audio', itemId: item.itemId, audioBase64 }] : []
  }

  if (type === 'response.output_audio.delta') {
    const responseId = asString(event.response_id)
    const audioBase64 = asString(event.delta)
    return responseId && audioBase64 ? [{ kind: 'agent_audio_delta', responseId, audioBase64 }] : []
  }

  if (
    type === 'output_audio_buffer.started' ||
    type === 'output_audio_buffer.stopped' ||
    type === 'output_audio_buffer.cleared'
  ) {
    const responseId = asString(event.response_id)
    const state = type.slice('output_audio_buffer.'.length) as 'started' | 'stopped' | 'cleared'
    return responseId ? [{ kind: 'agent_playback', responseId, state }] : []
  }

  return []
}
