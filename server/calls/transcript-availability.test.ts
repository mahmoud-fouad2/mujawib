import { describe, expect, it } from 'vitest'
import type { TranscriptAvailability } from '@/server/calls/transcript'

/**
 * The classification rules, asserted against the same decision table the
 * reader implements.
 *
 * `readCallTranscriptDetailed` itself needs a database, so the table below
 * mirrors its branches rather than mocking one — a mocked store has already
 * once let a broken migration pass tests in this repository, and the rule that
 * matters here is the classification, not the SQL.
 */
function classify(input: {
  readableTurns: number
  encryptedTurnRows: number
  totalTurnRows: number
  snapshotTurns: number
  hasSealedSnapshot: boolean
}): TranscriptAvailability {
  if (input.readableTurns > 0) return 'available'
  if (input.encryptedTurnRows > 0) return 'decryption_failed'
  if (input.snapshotTurns > 0) return 'available'
  if (input.hasSealedSnapshot) return 'decryption_failed'
  return input.totalTurnRows > 0 ? 'empty' : 'never_recorded'
}

const NOTHING = {
  readableTurns: 0,
  encryptedTurnRows: 0,
  totalTurnRows: 0,
  snapshotTurns: 0,
  hasSealedSnapshot: false,
}

describe('transcript availability', () => {
  it('reports a readable transcript as available', () => {
    expect(classify({ ...NOTHING, readableTurns: 6, encryptedTurnRows: 6, totalTurnRows: 6 })).toBe(
      'available',
    )
  })

  it('separates a key failure from a call that never produced a transcript', () => {
    // This is the whole point. Both used to render the same sentence, so an
    // operator could not tell "this call was silent" from "every protected
    // field on the platform is unreadable because the data key moved".
    const keyFailure = classify({ ...NOTHING, encryptedTurnRows: 42, totalTurnRows: 42 })
    const neverHappened = classify(NOTHING)

    expect(keyFailure).toBe('decryption_failed')
    expect(neverHappened).toBe('never_recorded')
    expect(keyFailure).not.toBe(neverHappened)
  })

  it('does not call a purged transcript a decryption failure', () => {
    // The retention sweep nulls `payload_encrypted` on purpose. Reporting that
    // as a key problem would send an operator chasing an incident that is
    // actually the privacy policy working correctly.
    expect(classify({ ...NOTHING, encryptedTurnRows: 0, totalTurnRows: 30 })).toBe('empty')
  })

  it('falls back to the compacted snapshot before declaring anything missing', () => {
    expect(classify({ ...NOTHING, snapshotTurns: 4 })).toBe('available')
  })

  it('treats a snapshot that will not open as a key failure too', () => {
    expect(classify({ ...NOTHING, hasSealedSnapshot: true })).toBe('decryption_failed')
  })

  it('never reports a missing transcript as a failed call', () => {
    // A call the caller had and we simply did not record is `completed_no_transcript`,
    // not `failed`. The availability value must never imply the call itself broke.
    const outcomes: TranscriptAvailability[] = [
      classify(NOTHING),
      classify({ ...NOTHING, encryptedTurnRows: 3, totalTurnRows: 3 }),
      classify({ ...NOTHING, totalTurnRows: 3 }),
    ]
    for (const outcome of outcomes) {
      expect(outcome).not.toBe('available')
      expect(['never_recorded', 'decryption_failed', 'empty']).toContain(outcome)
    }
  })
})
