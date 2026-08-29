import assert from 'node:assert/strict'
import {
  DEFAULT_REALTIME_MODEL,
  isRealtimeModelUnavailable,
  resolveRealtimeModel,
} from '../server/voice/model'
import { buildAcceptPayload, type ResolvedAgent, VOICE_MODEL } from '../server/voice/session'
import { toolsFor } from '../server/voice/tools'

function resolved(tools: ResolvedAgent['tools']): ResolvedAgent {
  return {
    matchedHeader: 'Diversion',
    matchedE164: '+16513711782',
    workspaceId: 'ws_test',
    workspaceName: 'Test workspace',
    agentId: 'ag_test',
    agentName: 'سارة',
    versionId: 'av_test',
    versionNumber: 19,
    instructions: 'تحدث بالعربية بوضوح.',
    tools,
    voice: 'cedar',
    transferTo: null,
    phoneNumberId: 'phone_test',
  }
}

const conversationOnly = buildAcceptPayload(resolved([]))
assert.equal(conversationOnly.model, VOICE_MODEL)
assert.equal(conversationOnly.audio.input.format.type, 'audio/pcmu')
assert.equal(conversationOnly.audio.output.voice, 'cedar')
assert.equal(conversationOnly.audio.input.transcription.model, 'gpt-4o-transcribe')
assert.equal(conversationOnly.audio.input.transcription.language, 'ar')
assert.equal('tools' in conversationOnly, false)
assert.equal('tool_choice' in conversationOnly, false)

const withCalendar = buildAcceptPayload(resolved(toolsFor(['google_calendar'])))
assert.ok(withCalendar.tools)
assert.equal(withCalendar.tools.length > 0, true)
assert.equal(withCalendar.tool_choice, 'auto')
assert.equal(withCalendar.parallel_tool_calls, false)

assert.equal(isRealtimeModelUnavailable('model_not_found'), true)
assert.equal(isRealtimeModelUnavailable('rate_limit_exceeded'), false)

const previousModel = process.env.OPENAI_REALTIME_MODEL
process.env.OPENAI_REALTIME_MODEL = 'gpt-realtime-unavailable-contract-test'
const fallbackModel = await resolveRealtimeModel(
  'test-key',
  async () => new Response(null, { status: 404 }),
)
assert.equal(fallbackModel, DEFAULT_REALTIME_MODEL)

process.env.OPENAI_REALTIME_MODEL = 'gpt-realtime-available-contract-test'
const configuredModel = await resolveRealtimeModel(
  'test-key',
  async () => new Response('{}', { status: 200 }),
)
assert.equal(configuredModel, 'gpt-realtime-available-contract-test')

if (previousModel === undefined) delete process.env.OPENAI_REALTIME_MODEL
else process.env.OPENAI_REALTIME_MODEL = previousModel

console.log('Realtime accept-session verification passed.')
