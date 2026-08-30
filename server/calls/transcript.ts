import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { normalizeTranscript, type TranscriptTurn } from '@/server/calls/presentation'
import { db } from '@/server/db'
import { call, callEvent } from '@/server/db/schema'
import { protectJson, revealJson } from '@/server/security/protected-data'

const TURN_TYPES = ['caller_turn', 'agent_turn']

export async function readCallTranscript(
  callId: string,
  fallbackEncrypted: string | null,
  fallback: unknown[],
): Promise<TranscriptTurn[]> {
  const events = await db
    .select({ payloadEncrypted: callEvent.payloadEncrypted })
    .from(callEvent)
    .where(and(eq(callEvent.callId, callId), inArray(callEvent.type, TURN_TYPES)))
    .orderBy(callEvent.occurredAt)

  const eventTurns = events.flatMap((event) => {
    const turn = revealJson<Record<string, unknown> | null>(event.payloadEncrypted, null)
    return turn ? [turn] : []
  })
  if (eventTurns.length > 0) return normalizeTranscript(eventTurns)
  return normalizeTranscript(revealJson<unknown[]>(fallbackEncrypted, fallback))
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
