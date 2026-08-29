import { describe, expect, it } from 'vitest'
import { resolveSidebandCloseDiagnostic } from './sideband-diagnostics'

describe('resolveSidebandCloseDiagnostic', () => {
  it('keeps the close frame reason ahead of fallback diagnostics', () => {
    expect(
      resolveSidebandCloseDiagnostic({
        code: 1011,
        frameReason: 'provider closed the session',
        socketError: 'socket reset',
        realtimeError: { code: 'session_error', message: 'model rejected the session' },
      }),
    ).toEqual({
      closeReason: 'provider closed the session',
      realtimeError: { code: 'session_error', message: 'model rejected the session' },
    })
  })

  it('uses the Realtime error when the transport supplies no reason', () => {
    expect(
      resolveSidebandCloseDiagnostic({
        code: 1006,
        frameReason: null,
        socketError: null,
        realtimeError: { code: 'model_not_found', message: 'configured model is unavailable' },
      }).closeReason,
    ).toBe('configured model is unavailable')
  })

  it('classifies a reasonless abnormal close instead of storing null', () => {
    expect(
      resolveSidebandCloseDiagnostic({
        code: 1006,
        frameReason: null,
        socketError: null,
        realtimeError: null,
      }).closeReason,
    ).toBe('sideband_transport_closed_without_frame')
  })
})
