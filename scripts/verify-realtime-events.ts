import assert from 'node:assert/strict'
import { actionsFromRealtimeEvent, initialGreetingEvent } from '../server/voice/realtime-events'

assert.deepEqual(initialGreetingEvent(), {
  type: 'response.create',
  response: {
    instructions:
      'ابدأ المكالمة الآن بجملة الافتتاح المحددة في تعليمات الجلسة، ثم انتظر رد المتصل. لا تضف شرحًا ولا تسأل أكثر من سؤال واحد.',
  },
})

const caller = actionsFromRealtimeEvent({
  event_id: 'evt_caller',
  type: 'conversation.item.input_audio_transcription.completed',
  item_id: 'item_caller',
  transcript: 'أرغب في حجز موعد غدًا',
})
assert.deepEqual(caller, [
  {
    kind: 'transcript',
    role: 'caller',
    text: 'أرغب في حجز موعد غدًا',
    sourceId: 'evt_caller',
    eventType: 'conversation.item.input_audio_transcription.completed',
    // A caller turn answers no response of ours, so it carries no response id.
    responseId: null,
  },
])

const agent = actionsFromRealtimeEvent({
  event_id: 'evt_agent',
  type: 'response.output_audio_transcript.done',
  item_id: 'item_agent',
  response_id: 'resp_agent',
  transcript: 'بكل تأكيد، ما الفترة المناسبة لك؟',
})
assert.equal(agent[0]?.kind, 'transcript')
assert.equal(agent[0]?.kind === 'transcript' ? agent[0].role : null, 'agent')
// The agent turn carries the response id so the transcript can look up the
// latency recorded when audio actually started, rather than measuring itself.
// Measuring here timed the arrival of the finished transcript — an event that
// only fires once the agent has stopped speaking.
assert.equal(agent[0]?.kind === 'transcript' ? agent[0].responseId : 'missing', 'resp_agent')

const directTool = actionsFromRealtimeEvent({
  event_id: 'evt_tool',
  type: 'response.function_call_arguments.done',
  call_id: 'call_tool_1',
  name: 'check_availability',
  arguments: '{"service":"استشارة","preferredDate":"tomorrow"}',
})
assert.deepEqual(directTool, [
  {
    kind: 'tool_call',
    toolCallId: 'call_tool_1',
    name: 'check_availability',
    argumentsJson: '{"service":"استشارة","preferredDate":"tomorrow"}',
    sourceId: 'evt_tool',
  },
])

const fallbackTools = actionsFromRealtimeEvent({
  event_id: 'evt_response',
  type: 'response.done',
  response: {
    output: [
      { type: 'message', role: 'assistant' },
      {
        type: 'function_call',
        id: 'item_tool_2',
        call_id: 'call_tool_2',
        name: 'create_callback',
        arguments: '{"customerPhone":"+966500000000","reason":"طلب متابعة"}',
      },
    ],
  },
})
assert.equal(fallbackTools.length, 2)
assert.equal(
  fallbackTools[0]?.kind === 'tool_call' ? fallbackTools[0].toolCallId : null,
  'call_tool_2',
)
assert.deepEqual(fallbackTools[1], {
  kind: 'lifecycle',
  state: 'response_finished',
  sourceId: 'evt_response',
  responseId: null,
})

assert.deepEqual(actionsFromRealtimeEvent({ type: 'response.created', event_id: 'evt_started' }), [
  { kind: 'lifecycle', state: 'response_started', sourceId: 'evt_started', responseId: null },
])

// First audio. This is the only event that says the caller has started hearing
// the reply, and it is what a turn's latency is now measured to.
assert.deepEqual(
  actionsFromRealtimeEvent({
    type: 'output_audio_buffer.started',
    event_id: 'evt_audio_start',
    response_id: 'resp_1',
  }),
  [
    {
      kind: 'lifecycle',
      state: 'output_audio_started',
      sourceId: 'evt_audio_start',
      responseId: 'resp_1',
    },
  ],
)

assert.deepEqual(
  actionsFromRealtimeEvent({ type: 'output_audio_buffer.stopped', event_id: 'evt_audio_done' }),
  [
    {
      kind: 'lifecycle',
      state: 'output_audio_stopped',
      sourceId: 'evt_audio_done',
      responseId: null,
    },
  ],
)

const error = actionsFromRealtimeEvent({
  event_id: 'evt_error',
  type: 'error',
  error: { code: 'invalid_request_error', message: 'Invalid client event' },
})
assert.deepEqual(error, [
  {
    kind: 'error',
    code: 'invalid_request_error',
    message: 'Invalid client event',
    sourceId: 'evt_error',
  },
])

assert.deepEqual(
  actionsFromRealtimeEvent({ type: 'rate_limits.updated', secret: 'do-not-copy' }),
  [],
)
assert.deepEqual(actionsFromRealtimeEvent('not-an-event'), [])
assert.deepEqual(
  actionsFromRealtimeEvent({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: '   ',
  }),
  [],
)

console.log('Realtime event contract verification passed.')
