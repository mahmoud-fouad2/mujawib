import { describe, expect, it } from 'vitest'
import { recordingActionsFromRealtimeEvent } from './recording-events'

describe('recordingActionsFromRealtimeEvent', () => {
  it('extracts caller timing and retrieves created user audio items', () => {
    expect(
      recordingActionsFromRealtimeEvent({
        type: 'input_audio_buffer.speech_started',
        item_id: 'item_1',
        audio_start_ms: 240,
      }),
    ).toEqual([{ kind: 'caller_boundary', boundary: 'start', itemId: 'item_1', atMs: 240 }])

    expect(
      recordingActionsFromRealtimeEvent({
        type: 'conversation.item.created',
        item: { id: 'item_1', role: 'user', content: [{ type: 'input_audio' }] },
      }),
    ).toEqual([{ kind: 'retrieve_caller_audio', itemId: 'item_1' }])
  })

  it('extracts retrieved caller audio without accepting assistant items', () => {
    const event = {
      type: 'conversation.item.retrieved',
      item: {
        id: 'item_1',
        role: 'user',
        content: [{ type: 'input_audio', audio: 'AQID' }],
      },
    }
    expect(recordingActionsFromRealtimeEvent(event)).toEqual([
      { kind: 'caller_audio', itemId: 'item_1', audioBase64: 'AQID' },
    ])
    expect(
      recordingActionsFromRealtimeEvent({
        ...event,
        item: { ...event.item, role: 'assistant' },
      }),
    ).toEqual([])
  })

  it('extracts agent audio and SIP playback boundaries', () => {
    expect(
      recordingActionsFromRealtimeEvent({
        type: 'response.output_audio.delta',
        response_id: 'resp_1',
        delta: 'BAUG',
      }),
    ).toEqual([{ kind: 'agent_audio_delta', responseId: 'resp_1', audioBase64: 'BAUG' }])
    expect(
      recordingActionsFromRealtimeEvent({
        type: 'response.audio.delta',
        response_id: 'resp_1',
        delta: 'BAUG',
      }),
    ).toEqual([{ kind: 'agent_audio_delta', responseId: 'resp_1', audioBase64: 'BAUG' }])
    expect(
      recordingActionsFromRealtimeEvent({
        type: 'output_audio_buffer.cleared',
        response_id: 'resp_1',
      }),
    ).toEqual([{ kind: 'agent_playback', responseId: 'resp_1', state: 'cleared' }])
  })

  it('ignores malformed and unrelated provider events', () => {
    expect(recordingActionsFromRealtimeEvent(null)).toEqual([])
    expect(recordingActionsFromRealtimeEvent({ type: 'response.done' })).toEqual([])
    expect(
      recordingActionsFromRealtimeEvent({
        type: 'response.output_audio.delta',
        response_id: 'resp_1',
      }),
    ).toEqual([])
  })
})
