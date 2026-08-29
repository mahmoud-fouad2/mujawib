export type RealtimeSessionError = {
  code: string | null
  message: string
}

type CloseDiagnosticInput = {
  code: number
  frameReason: string | null
  socketError: string | null
  realtimeError: RealtimeSessionError | null
}

export function resolveSidebandCloseDiagnostic(input: CloseDiagnosticInput) {
  const closeReason =
    input.frameReason ||
    input.socketError ||
    input.realtimeError?.message ||
    (input.code === 1006 ? 'sideband_transport_closed_without_frame' : null)

  return {
    closeReason,
    realtimeError: input.realtimeError,
  }
}
