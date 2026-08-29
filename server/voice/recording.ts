import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import WebSocket from 'ws'
import { env } from '@/lib/env'
import { recordingPolicyAllowsCapture } from '@/lib/recording-policy'
import { db } from '@/server/db'
import { call, callEvent, workspace } from '@/server/db/schema'
import {
  deleteRecording,
  putRecordingFile,
  recordingStorageReady,
} from '@/server/storage/recordings'
import { maskIdentifier, voiceError, voiceLog } from '@/server/voice/log'
import {
  composePcmuWav,
  PCMU_SAMPLE_RATE,
  type PcmuAudioSegment,
} from '@/server/voice/recording-audio'
import { recordingActionsFromRealtimeEvent } from '@/server/voice/recording-events'

const MAX_AUDIO_EVENT_BASE64_LENGTH = 48 * 1024 * 1024

type CallerRange = {
  startMs: number | null
  endMs: number | null
}

type AgentResponse = {
  path: string
  bytes: number
  firstDeltaAtMs: number | null
  playbackStartedAtMs: number | null
  closed: boolean
}

type RecordingResult = {
  filePath: string
  byteSize: number
  sha256: string
  durationSeconds: number
  partial: boolean
  warnings: string[]
}

function opaqueObjectKey(workspaceId: string, completedAt: Date) {
  const workspacePartition = createHash('sha256').update(workspaceId).digest('hex').slice(0, 16)
  const year = completedAt.getUTCFullYear()
  const month = String(completedAt.getUTCMonth() + 1).padStart(2, '0')
  return `recordings/v1/${year}/${month}/${workspacePartition}/${randomUUID()}.wav`
}

function eventId(callId: string, type: string) {
  const digest = createHash('sha256')
    .update(`${callId}\u0000${type}\u0000${Date.now()}\u0000${randomUUID()}`)
    .digest('hex')
    .slice(0, 24)
  return `cev_${digest}`
}

export class RealtimeRecordingCapture {
  private readonly maxSamples = env.RECORDING_MAX_SECONDS * PCMU_SAMPLE_RATE
  private readonly rootPromise: Promise<string>
  private readonly callerRanges = new Map<string, CallerRange>()
  private readonly requestedItems = new Set<string>()
  private readonly receivedItems = new Set<string>()
  private readonly agentResponses = new Map<string, AgentResponse>()
  private readonly agentPlaybackStarts = new Map<string, number>()
  private readonly segments: PcmuAudioSegment[] = []
  private readonly warnings = new Set<string>()
  private callerBytes = 0
  private agentBytes = 0
  private sequence = 0
  private finalized = false

  constructor(
    private readonly context: {
      callRecordId: string
      externalCallId: string
      workspaceId: string
      startedAt: Date
    },
  ) {
    this.rootPromise = mkdtemp(path.join(tmpdir(), 'mujawib-recording-'))
  }

  private elapsedMs() {
    return Math.max(0, Date.now() - this.context.startedAt.getTime())
  }

  private async nextPath(label: string) {
    const root = await this.rootPromise
    this.sequence += 1
    return path.join(root, `${String(this.sequence).padStart(4, '0')}-${label}.pcmu`)
  }

  private requestCallerAudio(ws: WebSocket, itemId: string) {
    if (this.requestedItems.has(itemId) || ws.readyState !== WebSocket.OPEN) return
    this.requestedItems.add(itemId)
    const suffix = createHash('sha256').update(itemId).digest('hex').slice(0, 20)
    ws.send(
      JSON.stringify({
        event_id: `rec_retrieve_${suffix}`,
        type: 'conversation.item.retrieve',
        item_id: itemId,
      }),
    )
  }

  private rememberCallerRange(itemId: string, boundary: 'start' | 'end', value: number) {
    const current = this.callerRanges.get(itemId) ?? { startMs: null, endMs: null }
    this.callerRanges.set(itemId, {
      startMs: boundary === 'start' ? value : current.startMs,
      endMs: boundary === 'end' ? value : current.endMs,
    })
  }

  private async storeCallerAudio(itemId: string, encoded: string) {
    if (this.receivedItems.has(itemId)) return
    this.receivedItems.add(itemId)
    if (encoded.length > MAX_AUDIO_EVENT_BASE64_LENGTH) {
      this.warnings.add('caller_item_too_large')
      return
    }

    const decoded = Buffer.from(encoded, 'base64')
    const remaining = Math.max(0, this.maxSamples - this.callerBytes)
    const audio = decoded.subarray(0, remaining)
    if (audio.length === 0) {
      this.warnings.add('recording_limit_reached')
      return
    }
    if (audio.length < decoded.length) this.warnings.add('recording_limit_reached')

    const range = this.callerRanges.get(itemId)
    const inferredStart =
      range?.endMs === null || range?.endMs === undefined
        ? this.elapsedMs() - (audio.length / PCMU_SAMPLE_RATE) * 1_000
        : range.endMs - (audio.length / PCMU_SAMPLE_RATE) * 1_000
    const startMs = Math.max(0, range?.startMs ?? inferredStart)
    const filePath = await this.nextPath('caller')
    await appendFile(filePath, audio)
    this.callerBytes += audio.length
    this.segments.push({
      path: filePath,
      startSample: Math.min(this.maxSamples, Math.round((startMs / 1_000) * PCMU_SAMPLE_RATE)),
      samples: audio.length,
      track: 'caller',
    })
  }

  private async appendAgentAudio(responseId: string, encoded: string) {
    if (encoded.length > MAX_AUDIO_EVENT_BASE64_LENGTH) {
      this.warnings.add('agent_event_too_large')
      return
    }
    const decoded = Buffer.from(encoded, 'base64')
    const remaining = Math.max(0, this.maxSamples - this.agentBytes)
    const audio = decoded.subarray(0, remaining)
    if (audio.length === 0) {
      this.warnings.add('recording_limit_reached')
      return
    }
    if (audio.length < decoded.length) this.warnings.add('recording_limit_reached')

    let response = this.agentResponses.get(responseId)
    if (!response) {
      response = {
        path: await this.nextPath('agent'),
        bytes: 0,
        firstDeltaAtMs: this.elapsedMs(),
        playbackStartedAtMs: this.agentPlaybackStarts.get(responseId) ?? null,
        closed: false,
      }
      this.agentResponses.set(responseId, response)
    }
    if (response.closed) return
    await appendFile(response.path, audio)
    response.bytes += audio.length
    this.agentBytes += audio.length
  }

  private startAgentPlayback(responseId: string) {
    const startedAtMs = this.elapsedMs()
    this.agentPlaybackStarts.set(responseId, startedAtMs)
    const response = this.agentResponses.get(responseId)
    if (response) response.playbackStartedAtMs ??= startedAtMs
  }

  private closeAgentPlayback(responseId: string, interrupted: boolean) {
    const response = this.agentResponses.get(responseId)
    if (!response || response.closed || response.bytes === 0) return
    const startMs = response.playbackStartedAtMs ?? response.firstDeltaAtMs
    if (startMs === null) {
      this.warnings.add('agent_timing_missing')
      return
    }

    const elapsedSamples = Math.max(
      0,
      Math.round(((this.elapsedMs() - startMs) / 1_000) * PCMU_SAMPLE_RATE),
    )
    const samples = interrupted ? Math.min(response.bytes, elapsedSamples) : response.bytes
    response.closed = true
    if (samples === 0) return
    this.segments.push({
      path: response.path,
      startSample: Math.min(this.maxSamples, Math.round((startMs / 1_000) * PCMU_SAMPLE_RATE)),
      samples,
      track: 'agent',
    })
  }

  async handleEvent(ws: WebSocket, value: unknown) {
    if (this.finalized) return
    for (const action of recordingActionsFromRealtimeEvent(value)) {
      if (action.kind === 'caller_boundary') {
        this.rememberCallerRange(action.itemId, action.boundary, action.atMs)
      } else if (action.kind === 'retrieve_caller_audio') {
        this.requestCallerAudio(ws, action.itemId)
      } else if (action.kind === 'caller_audio') {
        await this.storeCallerAudio(action.itemId, action.audioBase64)
      } else if (action.kind === 'agent_audio_delta') {
        await this.appendAgentAudio(action.responseId, action.audioBase64)
      } else if (action.state === 'started') {
        this.startAgentPlayback(action.responseId)
      } else {
        this.closeAgentPlayback(action.responseId, action.state === 'cleared')
      }
    }
  }

  noteWarning(code: string) {
    this.warnings.add(code)
  }

  private flushOpenResponses() {
    for (const [responseId, response] of this.agentResponses) {
      if (response.closed) continue
      this.warnings.add('agent_playback_end_missing')
      this.closeAgentPlayback(responseId, true)
    }
  }

  private async compose(): Promise<RecordingResult> {
    this.flushOpenResponses()
    for (const itemId of this.requestedItems) {
      if (!this.receivedItems.has(itemId)) this.warnings.add('caller_audio_missing')
    }
    const root = await this.rootPromise
    const outputPath = path.join(root, 'recording.wav')
    const audio = await composePcmuWav({
      segments: this.segments,
      maxSamples: this.maxSamples,
      outputPath,
    })

    return {
      filePath: outputPath,
      ...audio,
      partial: this.warnings.size > 0,
      warnings: [...this.warnings].sort(),
    }
  }

  async finalize() {
    if (this.finalized) return
    this.finalized = true
    const completedAt = new Date()
    let uploadedKey: string | null = null

    try {
      await db
        .update(call)
        .set({ recordingStatus: 'processing', recordingFailureCode: null })
        .where(eq(call.id, this.context.callRecordId))

      const result = await this.compose()
      const objectKey = opaqueObjectKey(this.context.workspaceId, completedAt)
      await putRecordingFile({
        objectKey,
        filePath: result.filePath,
        contentLength: result.byteSize,
        sha256: result.sha256,
      })
      uploadedKey = objectKey

      await db.transaction(async (tx) => {
        await tx
          .update(call)
          .set({
            recordingObjectKey: objectKey,
            recordingStatus: result.partial ? 'partial' : 'ready',
            recordingContentType: 'audio/wav',
            recordingByteSize: result.byteSize,
            recordingSha256: result.sha256,
            recordingFailureCode: null,
            recordingCompletedAt: completedAt,
          })
          .where(eq(call.id, this.context.callRecordId))
        await tx.insert(callEvent).values({
          id: eventId(this.context.callRecordId, 'recording_ready'),
          callId: this.context.callRecordId,
          type: 'recording_ready',
          payload: {
            partial: result.partial,
            warnings: result.warnings,
            bytes: result.byteSize,
            durationSeconds: Math.round(result.durationSeconds),
          },
          occurredAt: completedAt,
        })
      })

      voiceLog('RECORDING_READY', {
        callId: maskIdentifier(this.context.externalCallId),
        partial: result.partial,
        bytes: result.byteSize,
      })
    } catch (error) {
      if (uploadedKey) await deleteRecording(uploadedKey).catch(() => undefined)
      const failureCode =
        error instanceof Error && error.message === 'no_audio_captured'
          ? 'no_audio_captured'
          : 'recording_pipeline_failed'
      await db
        .update(call)
        .set({
          recordingObjectKey: null,
          recordingStatus: 'failed',
          recordingFailureCode: failureCode,
          recordingCompletedAt: completedAt,
        })
        .where(eq(call.id, this.context.callRecordId))
        .catch(() => undefined)
      voiceError('RECORDING_FAILED', {
        callId: maskIdentifier(this.context.externalCallId),
        code: failureCode,
      })
    } finally {
      const root = await this.rootPromise.catch(() => null)
      if (root) await rm(root, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

export async function startRealtimeRecording(context: {
  callRecordId: string
  externalCallId: string
  workspaceId: string
  startedAt: Date
}) {
  if (!recordingStorageReady()) return null
  const [policy] = await db
    .select({
      enabled: workspace.recordingEnabled,
      disclosureMode: workspace.recordingDisclosureMode,
      approvedAt: workspace.recordingApprovedAt,
    })
    .from(workspace)
    .where(eq(workspace.id, context.workspaceId))
    .limit(1)
  if (!policy || !recordingPolicyAllowsCapture(policy)) {
    voiceLog('RECORDING_SKIPPED', {
      callId: maskIdentifier(context.externalCallId),
      reason: policy ? 'workspace_policy_disabled' : 'workspace_not_found',
    })
    return null
  }
  await db
    .update(call)
    .set({
      recordingStatus: 'capturing',
      recordingObjectKey: null,
      recordingContentType: null,
      recordingByteSize: null,
      recordingSha256: null,
      recordingFailureCode: null,
      recordingCompletedAt: null,
    })
    .where(eq(call.id, context.callRecordId))
  return new RealtimeRecordingCapture(context)
}
