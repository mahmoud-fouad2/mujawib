/**
 * The one number that caps what a single call can cost.
 *
 * Every other safeguard on the inbound path — `overCapacity` in
 * `app/api/voice/incoming/route.ts` — counts calls, not minutes. A workspace
 * comfortably under its monthly call count can still hold one call open
 * indefinitely — a caller who never hangs up, a stuck line, a misbehaving
 * SIP leg — and each of those minutes is billed by OpenAI whether anyone is
 * still talking or not. Nothing upstream of this notices; a call count of one
 * looks identical whether it lasted ninety seconds or ninety minutes.
 *
 * This is the backstop: past this many minutes, `server/voice/sideband.ts`
 * ends the call itself, the same way the agent's own `end_call` tool does.
 * No real reception call needs anywhere near this long — the default is
 * generous specifically so it never touches a genuine conversation.
 */

export const DEFAULT_MAX_CALL_DURATION_MINUTES = 20
export const MIN_MAX_CALL_DURATION_MINUTES = 5
export const MAX_MAX_CALL_DURATION_MINUTES = 120

/**
 * Resolves `MAX_CALL_DURATION_MINUTES` to milliseconds, clamped to a sane
 * range regardless of what the environment says.
 *
 * Clamped rather than trusted: a value of `0` or empty would otherwise hang
 * up every call instantly, and a typo like `2000` (minutes, not the intended
 * seconds) would let a single call run for a month. Both are configuration
 * mistakes a live phone line should survive, not amplify.
 */
export function maxCallDurationMs(raw: string | undefined): number {
  const parsed = Number(raw)
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CALL_DURATION_MINUTES
  const clamped = Math.min(
    MAX_MAX_CALL_DURATION_MINUTES,
    Math.max(MIN_MAX_CALL_DURATION_MINUTES, minutes),
  )
  return clamped * 60_000
}
