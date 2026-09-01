import 'server-only'

import { and, eq, ne } from 'drizzle-orm'
import { recordingDisclosureInstruction } from '@/lib/recording-policy'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  flow,
  knowledgeItem,
  phoneNumber,
  pronunciation,
  voiceProfile,
  workspace,
} from '@/server/db/schema'
import { PRIMARY_REALTIME_MODEL } from '@/server/voice/model'
import { compilePrompt } from '@/server/voice/prompt'
import { toolsFor } from '@/server/voice/tools'

/**
 * Builds the Realtime session for an inbound call.
 *
 * The dialled number is the only thing an incoming webhook gives us, so it is
 * the key: number -> agent -> published version -> compiled instructions.
 * A number with no published version is never answered by a draft; the call is
 * refused so it can fall back to the human line rather than reach an untested
 * agent (Bible §23).
 */

/** Launch default — Bible §28. One model, audio to audio, no cascade. */
export const VOICE_MODEL = PRIMARY_REALTIME_MODEL

const VOICE_BY_DIALECT: Record<string, string> = {
  saudi: 'cedar',
  gulf: 'cedar',
  lebanese: 'marin',
  egyptian: 'marin',
  msa: 'marin',
}

type JsonRecord = Record<string, unknown>

export type ResolvedAgent = {
  /** Which SIP header and number actually matched a configured route. */
  matchedHeader: string
  matchedE164: string
  workspaceId: string
  workspaceName: string
  agentId: string
  agentName: string
  versionId: string
  versionNumber: number
  instructions: string
  tools: ReturnType<typeof toolsFor>
  voice: string
  pacing: JsonRecord | null
  transferTo: string | null
  phoneNumberId: string
  recordingDisclosureMode: string
  /** null = unlimited. */
  monthlyCallLimit: number | null
  concurrentCallLimit: number
  crmEnabled: boolean
}

/**
 * Resolves one E.164 number to its published agent.
 *
 * Matches only an explicitly configured `phone_number` row. There is no
 * default client and no first-row fallback: an unknown DID must stay
 * unresolved so the call can be rejected rather than answered by whichever
 * agent happened to be created first.
 */
async function resolveAgentForNumber(
  dialled: string,
  matchedHeader = 'To',
): Promise<ResolvedAgent | null> {
  const e164 = dialled.trim().replace(/[^\d+]/g, '')
  if (!e164) return null

  const [row] = await db
    .select({
      phone: phoneNumber,
      ws: workspace,
      ag: agent,
    })
    .from(phoneNumber)
    .innerJoin(workspace, eq(phoneNumber.workspaceId, workspace.id))
    .leftJoin(agent, and(eq(phoneNumber.agentId, agent.id), eq(agent.workspaceId, workspace.id)))
    .where(and(eq(phoneNumber.e164, e164), ne(phoneNumber.sipStatus, 'disabled')))
    .limit(1)

  if (!row?.ag?.liveVersionId) return null

  const [version] = await db
    .select()
    .from(agentVersion)
    .where(and(eq(agentVersion.id, row.ag.liveVersionId), eq(agentVersion.status, 'published')))
    .limit(1)

  // A draft must never answer a real caller.
  if (!version) return null

  const [profile, knowledge, words, versionFlows] = await Promise.all([
    version.voiceProfileId
      ? db.select().from(voiceProfile).where(eq(voiceProfile.id, version.voiceProfileId)).limit(1)
      : Promise.resolve([]),
    db.select().from(knowledgeItem).where(eq(knowledgeItem.workspaceId, row.ws.id)),
    db.select().from(pronunciation).where(eq(pronunciation.workspaceId, row.ws.id)),
    db.select().from(flow).where(eq(flow.agentVersionId, version.id)).orderBy(flow.sortOrder),
  ])

  const resolvedProfile = profile[0] ?? null
  const bindings = ((version.toolBindings ?? []) as string[]).filter(Boolean)
  const rules = (version.businessRules ?? {}) as { transferTo?: string }

  return {
    matchedHeader,
    matchedE164: e164,
    workspaceId: row.ws.id,
    workspaceName: row.ws.name,
    agentId: row.ag.id,
    agentName: row.ag.name,
    versionId: version.id,
    versionNumber: version.versionNumber,
    instructions: compilePrompt({
      workspace: row.ws,
      version,
      agentName: row.ag.name,
      profile: resolvedProfile,
      knowledge,
      pronunciations: words,
      flows: versionFlows,
    }),
    tools: toolsFor(bindings, {
      voiceCancellationEnabled: version.voiceCancellationEnabled,
    }),
    voice: VOICE_BY_DIALECT[resolvedProfile?.dialect ?? 'msa'] ?? 'marin',
    pacing:
      resolvedProfile?.pacing && typeof resolvedProfile.pacing === 'object'
        ? (resolvedProfile.pacing as JsonRecord)
        : null,
    transferTo: rules.transferTo ?? row.phone.transferDestination ?? null,
    phoneNumberId: row.phone.id,
    recordingDisclosureMode: row.ws.recordingDisclosureMode,
    monthlyCallLimit: row.ws.monthlyCallLimit,
    concurrentCallLimit: row.ws.concurrentCallLimit,
    crmEnabled: row.ws.crmEnabled,
  }
}

/**
 * Tries every DID candidate found in the SIP headers against the configured
 * routes, returning the first that resolves to a published agent.
 *
 * The provider's choice of header is discovered here rather than assumed: the
 * resolved value records which header matched, so the first real call tells us
 * what to narrow to.
 */
export async function resolveAgentFromCandidates(
  candidates: { header: string; e164: string }[],
): Promise<ResolvedAgent | null> {
  for (const candidate of candidates) {
    const resolved = await resolveAgentForNumber(candidate.e164, candidate.header)
    if (resolved) return resolved
  }
  return null
}

/**
 * The payload sent to POST /v1/realtime/calls/{call_id}/accept.
 *
 * Server VAD with a slightly long silence window: Arabic callers pause mid
 * sentence more than the default 500ms allows, and cutting them off is the
 * fastest way to make an agent feel robotic.
 */
export function buildAcceptPayload(
  resolved: ResolvedAgent,
  model = VOICE_MODEL,
  callerNumber: string | null = null,
) {
  // Tools are omitted entirely rather than sent as an empty array: a version
  // with no bindings is conversation-only, and an empty list plus
  // `tool_choice: auto` is a contradiction to hand a strict validator.
  const toolFields =
    resolved.tools.length > 0
      ? {
          tools: resolved.tools,
          tool_choice: 'auto' as const,
          // Business mutations are intentionally serialized. A transfer and a
          // booking must never race to write two incompatible call outcomes.
          parallel_tool_calls: false,
        }
      : {}

  const disclosureInstruction = recordingDisclosureInstruction(resolved.recordingDisclosureMode)
  const callerInstruction = callerNumber
    ? `رقم الاتصال الموثوق لهذه المكالمة هو ${callerNumber}.
- اعتبر هذا الرقم رقم المتصل الأساسي. لا تسأل المتصل عن رقم الجوال أثناء الحجز أو المتابعة إلا إذا قال صراحةً إنه يريد استخدام رقم آخر.
- عند الحاجة للتأكد، قل: «أستخدم الرقم المنتهي بـ ${callerNumber.slice(-4)}؟» ولا تطلب منه إملاء الرقم كاملًا.
- مرّر هذا الرقم تلقائيًا إلى create_booking وcreate_callback وsend_confirmation إذا احتاجت الأداة رقمًا ولم يذكر المتصل رقمًا بديلًا.
- إذا طلب المتصل سماع الرقم كاملًا، انطقه رقمًا رقمًا بلا حذف أي أرقام من الوسط.
- لا تعرض الرقم في أي سجل أو رسالة تقنية.`
    : `لم يصل رقم موثوق للمتصل. اطلب رقم الجوال مرة واحدة فقط عند الحاجة إلى حجز أو متابعة.`
  const instructions = [disclosureInstruction, callerInstruction, resolved.instructions]
    .filter(Boolean)
    .join('\n\n')
  const turnDetection = turnDetectionSettings(resolved.pacing)

  return {
    type: 'realtime',
    model,
    instructions,
    audio: {
      input: {
        format: { type: 'audio/pcmu' },
        // Input transcription is asynchronous and is used for the operator
        // record; the speech-to-speech model still listens to the audio itself.
        transcription: {
          model: 'gpt-4o-transcribe',
          language: 'ar',
          prompt: 'مكالمة خدمة عملاء عربية. قد تتضمن أسماء أشخاص وشركات ومصطلحات إنجليزية.',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: turnDetection.threshold,
          prefix_padding_ms: turnDetection.prefixPaddingMs,
          silence_duration_ms: turnDetection.silenceDurationMs,
          idle_timeout_ms: turnDetection.idleTimeoutMs,
          interrupt_response: true,
        },
      },
      output: {
        format: { type: 'audio/pcmu' },
        voice: resolved.voice,
      },
    },
    ...toolFields,
  }
}

function numberSetting(
  source: JsonRecord | null,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = source?.[key]
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, number))
}

function turnDetectionSettings(pacing: JsonRecord | null) {
  return {
    threshold: numberSetting(pacing, 'vadThreshold', 0.5, 0.35, 0.75),
    prefixPaddingMs: Math.round(numberSetting(pacing, 'prefixPaddingMs', 240, 120, 500)),
    silenceDurationMs: Math.round(numberSetting(pacing, 'silenceDurationMs', 520, 380, 900)),
    idleTimeoutMs: Math.round(numberSetting(pacing, 'idleTimeoutMs', 7_000, 4_000, 15_000)),
  }
}
