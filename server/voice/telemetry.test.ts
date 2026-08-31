import { describe, expect, it } from 'vitest'
import {
  createTimeline,
  currentCallContext,
  markTimeline,
  timelineSnapshot,
  withCallContext,
} from '@/server/voice/telemetry'

describe('call timeline', () => {
  it('records offsets from the webhook, not absolute times', () => {
    const timeline = createTimeline(1_000)
    expect(markTimeline(timeline, 'signature_verified', 1_040)).toBe(40)
    expect(timeline.marks.signature_verified).toBe(40)
  })

  it('keeps the first occurrence of a stage', () => {
    // A webhook redelivery or a reconnect drives the same stage twice. The
    // first is the one that describes what the caller actually experienced.
    const timeline = createTimeline(1_000)
    markTimeline(timeline, 'accept_response_received', 1_200)
    markTimeline(timeline, 'accept_response_received', 9_999)
    expect(timeline.marks.accept_response_received).toBe(200)
  })

  it('never records a negative offset from clock skew', () => {
    const timeline = createTimeline(5_000)
    expect(markTimeline(timeline, 'webhook_received', 4_000)).toBe(0)
  })

  it('derives the two numbers an operator asks for', () => {
    const timeline = createTimeline(0)
    markTimeline(timeline, 'accept_request_started', 300)
    markTimeline(timeline, 'accept_response_received', 500)
    markTimeline(timeline, 'first_audio_started', 1_100)

    const snapshot = timelineSnapshot(timeline)
    expect(snapshot.answerMs).toBe(200)
    // Dead air between the call being answered and the caller hearing a voice.
    expect(snapshot.firstAudioMs).toBe(600)
    expect(snapshot.timeToFirstAudioMs).toBe(1_100)
  })

  it('omits derived spans whose endpoints were never reached', () => {
    const timeline = createTimeline(0)
    markTimeline(timeline, 'accept_request_started', 300)
    const snapshot = timelineSnapshot(timeline)
    expect(snapshot.answerMs).toBeUndefined()
    expect(snapshot.firstAudioMs).toBeUndefined()
  })

  it('tolerates a missing timeline so logging can never break a call', () => {
    expect(markTimeline(null, 'webhook_received')).toBeNull()
    expect(markTimeline(undefined, 'webhook_received')).toBeNull()
  })
})

describe('ambient call context', () => {
  it('is visible to anything running inside the scope', () => {
    const timeline = createTimeline(0)
    const seen = withCallContext(
      { callId: 'call_abc', externalCallId: 'rtc_***', workspaceId: 'ws_1', timeline },
      () => currentCallContext()?.callId,
    )
    expect(seen).toBe('call_abc')
  })

  it('is absent outside any call', () => {
    expect(currentCallContext()).toBeUndefined()
  })

  it('survives an await, so async stages stay tagged', async () => {
    const timeline = createTimeline(0)
    const seen = await withCallContext(
      { callId: 'call_xyz', externalCallId: null, workspaceId: null, timeline },
      async () => {
        await Promise.resolve()
        return currentCallContext()?.callId
      },
    )
    expect(seen).toBe('call_xyz')
  })
})
