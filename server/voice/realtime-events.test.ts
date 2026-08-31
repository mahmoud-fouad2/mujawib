import { describe, expect, it } from 'vitest'
import {
  actionsFromRealtimeEvent,
  type RealtimeAction,
  shouldSendInitialGreeting,
} from '@/server/voice/realtime-events'

function lifecycleStates(actions: RealtimeAction[]) {
  return actions.flatMap((action) => (action.kind === 'lifecycle' ? [action.state] : []))
}

describe('first-audio signal', () => {
  it('maps output_audio_buffer.started, which is when the caller starts hearing the reply', () => {
    const actions = actionsFromRealtimeEvent({
      type: 'output_audio_buffer.started',
      event_id: 'evt_1',
      response_id: 'resp_1',
    })
    expect(lifecycleStates(actions)).toEqual(['output_audio_started'])
    const [action] = actions
    expect(action?.kind === 'lifecycle' && action.responseId).toBe('resp_1')
  })

  it('still distinguishes audio starting from audio stopping', () => {
    const stopped = actionsFromRealtimeEvent({
      type: 'output_audio_buffer.stopped',
      response_id: 'resp_1',
    })
    expect(lifecycleStates(stopped)).toEqual(['output_audio_stopped'])
  })
})

describe('turn latency does not depend on the transcript', () => {
  it('carries a response id on the agent transcript so it can read the recorded timing', () => {
    // The transcript is where latency used to be *measured*, which timed the
    // arrival of the finished text — an event that only fires once the agent
    // has stopped speaking, so a long answer read as a long latency. It now
    // only carries the response id, and looks the real number up.
    const actions = actionsFromRealtimeEvent({
      type: 'response.output_audio_transcript.done',
      event_id: 'evt_2',
      response_id: 'resp_7',
      transcript: 'أهلاً وسهلاً',
    })
    const [action] = actions
    expect(action?.kind).toBe('transcript')
    if (action?.kind !== 'transcript') return
    expect(action.role).toBe('agent')
    expect(action.responseId).toBe('resp_7')
    // Nothing time-shaped is produced here at all.
    expect(Object.keys(action)).not.toContain('latencyMs')
  })

  it('gives a caller transcript no response id, because it does not answer one', () => {
    const actions = actionsFromRealtimeEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_1',
      transcript: 'أبغى أحجز موعد',
    })
    const [action] = actions
    expect(action?.kind === 'transcript' && action.responseId).toBeNull()
  })

  it('records where a turn starts', () => {
    const actions = actionsFromRealtimeEvent({
      type: 'input_audio_buffer.speech_stopped',
      event_id: 'evt_3',
    })
    expect(lifecycleStates(actions)).toEqual(['speech_stopped'])
  })
})

describe('greeting on resume', () => {
  it('greets a genuinely new call', () => {
    expect(shouldSendInitialGreeting({})).toBe(true)
    expect(shouldSendInitialGreeting({ resumed: false })).toBe(true)
  })

  it('stays silent when reattaching to a call already in progress', () => {
    // Reconnecting after the answering process was replaced used to make the
    // agent restate its opening line in the middle of the conversation.
    expect(shouldSendInitialGreeting({ resumed: true })).toBe(false)
  })
})
