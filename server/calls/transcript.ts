import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { normalizeTranscript, type TranscriptTurn } from '@/server/calls/presentation'
import { db } from '@/server/db'
import { call, callEvent } from '@/server/db/schema'
import { protectJson, revealJson } from '@/server/security/protected-data'

const TURN_TYPES = ['caller_turn', 'agent_turn']

/**
 * Why a call has no transcript, when it has none.
 *
 * These were previously indistinguishable: every path returned an empty array,
 * so a call whose turns were never recorded looked exactly like a call whose
 * turns are all sitting in the database, encrypted, and unreadable because the
 * data key moved. The second is recoverable and urgent — it means every
 * protected field on the platform is reading back empty — and the operator was
 * being shown the same shrug for both.
 *
 * `revealString` fails closed by design (server/security/protected-data.ts),
 * which is the right call for a decryption boundary. Failing closed *silently*
 * is what has to stop.
 */
export type TranscriptAvailability =
  | 'available'
  /** No turn events and no snapshot — the runtime never recorded anything. */
  | 'never_recorded'
  /** Turn rows exist but none decrypted. Almost always a key change. */
  | 'decryption_failed'
  /** Rows existed and were readable, but held no usable turns. */
  | 'empty'

export type TranscriptRead = {
  turns: TranscriptTurn[]
  availability: TranscriptAvailability
  /** Turn events stored for this call, whether or not they could be read. */
  storedTurnEvents: number
  /** How many of those actually decrypted. */
  readableTurnEvents: number
}

export async function readCallTranscriptDetailed(
  callId: string,
  fallbackEncrypted: string | null,
  fallback: unknown[],
): Promise<TranscriptRead> {
  const events = await db
    .select({ payloadEncrypted: callEvent.payloadEncrypted })
    .from(callEvent)
    .where(and(eq(callEvent.callId, callId), inArray(callEvent.type, TURN_TYPES)))
    .orderBy(callEvent.occurredAt)

  // A row whose payload was already cleared by the retention sweep is not a
  // decryption failure — it is a deliberate purge, and must not be reported
  // as a key problem.
  const encrypted = events.filter((event) => event.payloadEncrypted !== null)
  const eventTurns = encrypted.flatMap((event) => {
    const turn = revealJson<Record<string, unknown> | null>(event.payloadEncrypted, null)
    return turn ? [turn] : []
  })

  if (eventTurns.length > 0) {
    return {
      turns: normalizeTranscript(eventTurns),
      availability: 'available',
      storedTurnEvents: encrypted.length,
      readableTurnEvents: eventTurns.length,
    }
  }

  // Turn rows are present and hold ciphertext, yet none of them opened.
  if (encrypted.length > 0) {
    return {
      turns: [],
      availability: 'decryption_failed',
      storedTurnEvents: encrypted.length,
      readableTurnEvents: 0,
    }
  }

  const snapshot = normalizeTranscript(revealJson<unknown[]>(fallbackEncrypted, fallback))
  if (snapshot.length > 0) {
    return {
      turns: snapshot,
      availability: 'available',
      storedTurnEvents: 0,
      readableTurnEvents: 0,
    }
  }

  // A sealed snapshot that will not open is the same failure as above.
  if (fallbackEncrypted) {
    return {
      turns: [],
      availability: 'decryption_failed',
      storedTurnEvents: 0,
      readableTurnEvents: 0,
    }
  }

  return {
    turns: [],
    availability: events.length > 0 ? 'empty' : 'never_recorded',
    storedTurnEvents: 0,
    readableTurnEvents: 0,
  }
}

/** The turns alone, for callers that do not present a reason to anyone. */
export async function readCallTranscript(
  callId: string,
  fallbackEncrypted: string | null,
  fallback: unknown[],
): Promise<TranscriptTurn[]> {
  const result = await readCallTranscriptDetailed(callId, fallbackEncrypted, fallback)
  return result.turns
}

/** Compacts append-only encrypted turn events into the legacy call snapshot once. */
export async function compactCallTranscript(callId: string): Promise<TranscriptTurn[]> {
  const [row] = await db
    .select({ transcript: call.transcript, transcriptEncrypted: call.transcriptEncrypted })
    .from(call)
    .where(eq(call.id, callId))
    .limit(1)
  if (!row) return []

  const transcript = await readCallTranscript(
    callId,
    row.transcriptEncrypted,
    Array.isArray(row.transcript) ? row.transcript : [],
  )
  if (transcript.length > 0) {
    await db
      .update(call)
      .set({ transcript: [], transcriptEncrypted: protectJson(transcript) })
      .where(eq(call.id, callId))
  }
  return transcript
}
