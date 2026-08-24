import 'server-only'

import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import WebSocket, { type RawData } from 'ws'
import { env } from '@/lib/env'
import type { ScenarioInput, TestLabToolCall, TestLabTranscriptTurn } from '@/lib/test-lab'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  knowledgeItem,
  pronunciation,
  voiceProfile,
  workspace,
} from '@/server/db/schema'
import { compilePrompt } from '@/server/voice/prompt'
import { VOICE_MODEL } from '@/server/voice/session'
import { toolsFor } from '@/server/voice/tools'

type JsonRecord = Record<string, unknown>

export type VersionRuntime = {
  versionId: string
  workspaceId: string
  workspaceName: string
  agentId: string
  agentName: string
  versionNumber: number
  status: string
  instructions: string
  tools: ReturnType<typeof toolsFor>
}

export type RealtimeScenarioOutput =
  | {
      ok: true
      durationMs: number
      transcript: TestLabTranscriptTurn[]
      toolCalls: TestLabToolCall[]
    }
  | {
      ok: false
      durationMs: number
      transcript: TestLabTranscriptTurn[]
      toolCalls: TestLabToolCall[]
      reasonCode: string
      message: string
    }

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseResponseOutput(response: JsonRecord) {
  const transcript: TestLabTranscriptTurn[] = []
  const toolCalls: TestLabToolCall[] = []
  const output = Array.isArray(response.output) ? response.output : []

  for (const rawItem of output) {
    const item = asRecord(rawItem)
    if (!item) continue

    if (item.type === 'message' && item.role === 'assistant') {
      const content = Array.isArray(item.content) ? item.content : []
      const text = content
        .map((rawPart) => {
          const part = asRecord(rawPart)
          return part?.type === 'output_text' ? asString(part.text) : null
        })
        .filter((part): part is string => Boolean(part))
        .join(' ')
      if (text) transcript.push({ role: 'agent', text })
    }

    if (item.type === 'function_call') {
      const name = asString(item.name)
      if (name) {
        toolCalls.push({
          name,
          argumentsJson: asString(item.arguments) ?? '{}',
        })
      }
    }
  }

  return { transcript, toolCalls }
}

export async function loadVersionRuntime(versionId: string): Promise<VersionRuntime | null> {
  const [row] = await db
    .select({ version: agentVersion, agent, workspace })
    .from(agentVersion)
    .innerJoin(agent, eq(agentVersion.agentId, agent.id))
    .innerJoin(workspace, eq(agent.workspaceId, workspace.id))
    .where(eq(agentVersion.id, versionId))
    .limit(1)

  if (!row || row.version.status === 'archived') return null

  const [profiles, knowledge, pronunciations] = await Promise.all([
    row.version.voiceProfileId
      ? db
          .select()
          .from(voiceProfile)
          .where(eq(voiceProfile.id, row.version.voiceProfileId))
          .limit(1)
      : Promise.resolve([]),
    db.select().from(knowledgeItem).where(eq(knowledgeItem.workspaceId, row.workspace.id)),
    db.select().from(pronunciation).where(eq(pronunciation.workspaceId, row.workspace.id)),
  ])

  const bindings = ((row.version.toolBindings ?? []) as string[]).filter(Boolean)
  return {
    versionId: row.version.id,
    workspaceId: row.workspace.id,
    workspaceName: row.workspace.name,
    agentId: row.agent.id,
    agentName: row.agent.name,
    versionNumber: row.version.versionNumber,
    status: row.version.status,
    instructions: compilePrompt({
      workspace: row.workspace,
      version: row.version,
      agentName: row.agent.name,
      profile: profiles[0] ?? null,
      knowledge,
      pronunciations,
    }),
    tools: toolsFor(bindings),
  }
}

function safetyIdentifier(workspaceId: string) {
  return createHash('sha256').update(`mujawib-test-lab:${workspaceId}`).digest('hex')
}

export async function runRealtimeScenario(
  runtime: VersionRuntime,
  input: ScenarioInput,
): Promise<RealtimeScenarioOutput> {
  const startedAt = Date.now()
  const transcript: TestLabTranscriptTurn[] = []
  const toolCalls: TestLabToolCall[] = []
  const apiKey = env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      ok: false,
      durationMs: 0,
      transcript,
      toolCalls,
      reasonCode: 'openai_not_configured',
      message: 'تشغيل الاختبارات غير مفعّل في هذه البيئة.',
    }
  }

  return new Promise<RealtimeScenarioOutput>((resolve) => {
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(VOICE_MODEL)}`
    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Safety-Identifier': safetyIdentifier(runtime.workspaceId),
      },
    })
    let settled = false
    let turnIndex = 0
    let sessionUpdated = false

    const finish = (result: RealtimeScenarioOutput) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'scenario complete')
      }
      resolve(result)
    }

    const fail = (reasonCode: string, message: string) =>
      finish({
        ok: false,
        durationMs: Date.now() - startedAt,
        transcript,
        toolCalls,
        reasonCode,
        message,
      })

    const timeout = setTimeout(
      () => fail('realtime_timeout', 'انتهت مهلة الاختبار قبل اكتمال الرد.'),
      45_000,
    )

    const sendTurn = () => {
      const text = input.turns[turnIndex]
      if (!text) {
        finish({
          ok: true,
          durationMs: Date.now() - startedAt,
          transcript,
          toolCalls,
        })
        return
      }

      transcript.push({ role: 'caller', text })
      socket.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
        }),
      )
      socket.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            output_modalities: ['text'],
            metadata: {
              surface: 'mujawib_test_lab',
              version_id: runtime.versionId,
            },
          },
        }),
      )
    }

    socket.on('open', () => {
      const toolFields = runtime.tools.length
        ? { tools: runtime.tools, tool_choice: 'auto', parallel_tool_calls: false }
        : {}
      socket.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            model: VOICE_MODEL,
            output_modalities: ['text'],
            instructions: runtime.instructions,
            max_output_tokens: 500,
            ...toolFields,
          },
        }),
      )
    })

    socket.on('message', (raw: RawData) => {
      let event: JsonRecord | null = null
      try {
        event = asRecord(JSON.parse(raw.toString()))
      } catch {
        fail('invalid_realtime_event', 'وصل رد غير صالح من خدمة الاختبار.')
        return
      }

      const type = asString(event?.type)
      if (!event || !type) return

      if (type === 'session.updated' && !sessionUpdated) {
        sessionUpdated = true
        sendTurn()
        return
      }

      if (type === 'error') {
        const error = asRecord(event.error)
        fail(asString(error?.code) ?? 'realtime_error', 'تعذّر إكمال الاختبار عبر Realtime.')
        return
      }

      if (type !== 'response.done') return
      const response = asRecord(event.response)
      if (!response) {
        fail('missing_realtime_response', 'لم يصل رد مكتمل من خدمة الاختبار.')
        return
      }

      const status = asString(response.status)
      if (status && status !== 'completed') {
        fail(`response_${status}`, 'لم يكتمل رد الاختبار بنجاح.')
        return
      }

      const parsed = parseResponseOutput(response)
      transcript.push(...parsed.transcript)
      toolCalls.push(...parsed.toolCalls)
      turnIndex += 1

      // Never fabricate a tool result. A requested action is the observable
      // outcome under test, so the scenario ends at that boundary.
      if (parsed.toolCalls.length > 0 || turnIndex >= input.turns.length) {
        finish({
          ok: true,
          durationMs: Date.now() - startedAt,
          transcript,
          toolCalls,
        })
      } else {
        sendTurn()
      }
    })

    socket.on('unexpected-response', (_request, response) => {
      fail(`openai_http_${response.statusCode}`, 'رفضت خدمة Realtime بدء جلسة الاختبار.')
    })

    socket.on('error', () => {
      fail('realtime_connection_failed', 'تعذّر الاتصال بخدمة Realtime.')
    })

    socket.on('close', (code) => {
      if (!settled && code !== 1000) {
        fail(`realtime_closed_${code}`, 'أُغلقت جلسة الاختبار قبل اكتمال الرد.')
      }
    })
  })
}
