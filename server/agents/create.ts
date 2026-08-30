import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq, or } from 'drizzle-orm'
import { buildAgentBlueprint } from '@/lib/agent-blueprints'
import { db } from '@/server/db'
import {
  agent,
  agentVersion,
  auditLog,
  flow,
  industryTemplate,
  integrationConnection,
  knowledgeItem,
  pronunciation,
  scenarioTest,
  voiceProfile,
  workspace,
} from '@/server/db/schema'
import { compilePrompt } from '@/server/voice/prompt'

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export async function createVoiceAgentDraft(input: {
  workspaceId: string
  name: string
  voiceProfileId: string
  actorId: string
}) {
  const agentId = id('agent')
  const versionId = id('av')
  const now = new Date()

  return db.transaction(async (tx) => {
    const [ws] = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, input.workspaceId))
      .for('update')
      .limit(1)
    if (ws?.type !== 'client' || ws.status === 'archived') {
      return { ok: false as const, error: 'العميل غير متاح لإنشاء موظف صوتي.' }
    }

    const [duplicate] = await tx
      .select({ id: agent.id })
      .from(agent)
      .where(and(eq(agent.workspaceId, ws.id), eq(agent.name, input.name)))
      .limit(1)
    if (duplicate) return { ok: false as const, error: 'يوجد موظف بالاسم نفسه لدى هذا العميل.' }

    const [profile] = await tx
      .select()
      .from(voiceProfile)
      .where(
        and(
          eq(voiceProfile.id, input.voiceProfileId),
          or(eq(voiceProfile.workspaceId, ws.id), eq(voiceProfile.isGlobal, true)),
        ),
      )
      .limit(1)
    if (!profile) return { ok: false as const, error: 'الملف الصوتي غير متاح لهذا العميل.' }

    const [template, connections, knowledge, pronunciations] = await Promise.all([
      ws.industryPack
        ? tx
            .select()
            .from(industryTemplate)
            .where(eq(industryTemplate.packKey, ws.industryPack))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      tx
        .select({ provider: integrationConnection.provider })
        .from(integrationConnection)
        .where(eq(integrationConnection.workspaceId, ws.id)),
      tx.select().from(knowledgeItem).where(eq(knowledgeItem.workspaceId, ws.id)),
      tx.select().from(pronunciation).where(eq(pronunciation.workspaceId, ws.id)),
    ])

    const businessInfo = (ws.businessInfo ?? {}) as {
      hours?: { sun_thu?: string }
      transferTo?: string
    }
    const toolBindings = [...new Set(connections.map((connection) => connection.provider))]
    const blueprint = buildAgentBlueprint({
      agentName: input.name,
      workspaceName: ws.name,
      industryPack: ws.industryPack,
      hours: businessInfo.hours?.sun_thu,
      transferTo: businessInfo.transferTo,
      toolBindings,
    })

    await tx.insert(agent).values({
      id: agentId,
      workspaceId: ws.id,
      name: input.name,
      templateId: template?.id ?? null,
      liveVersionId: null,
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(agentVersion).values({
      id: versionId,
      agentId,
      versionNumber: 1,
      status: 'draft',
      identity: blueprint.identity,
      voiceProfileId: profile.id,
      businessRules: blueprint.businessRules,
      flows: blueprint.flows.map((item) => item.name),
      toolBindings,
      routing: blueprint.routing,
      readinessScore: 0,
      blockers: [],
      createdAt: now,
      updatedAt: now,
    })

    const flowRows = blueprint.flows.map((item, index) => ({
      id: id('flow'),
      agentVersionId: versionId,
      name: item.name,
      goal: item.goal,
      requiredFields: item.requiredFields,
      actions: item.actions,
      fallback: item.fallback,
      sortOrder: index,
      createdAt: now,
    }))
    await tx.insert(flow).values(flowRows)
    await tx.insert(scenarioTest).values(
      blueprint.scenarios.map((scenario) => ({
        id: id('scenario'),
        agentVersionId: versionId,
        name: scenario.name,
        category: scenario.category,
        input: scenario.input,
        expectedOutcome: scenario.expectation,
        isCritical: scenario.isCritical,
        createdAt: now,
        updatedAt: now,
      })),
    )

    const [storedVersion] = await tx
      .select()
      .from(agentVersion)
      .where(eq(agentVersion.id, versionId))
      .limit(1)
    if (!storedVersion) throw new Error('New agent version was not persisted')
    const compiledPrompt = compilePrompt({
      workspace: ws,
      version: storedVersion,
      agentName: input.name,
      profile,
      knowledge,
      pronunciations,
      flows: flowRows,
    })
    await tx
      .update(agentVersion)
      .set({ compiledPrompt, updatedAt: now })
      .where(eq(agentVersion.id, versionId))

    await tx.insert(auditLog).values({
      id: id('audit'),
      workspaceId: ws.id,
      actorId: input.actorId,
      action: 'agent.created',
      resourceType: 'agent',
      resourceId: agentId,
      metadata: {
        note: `إنشاء الموظف الصوتي «${input.name}» ومسودة v1 مع ${blueprint.scenarios.length} سيناريو`,
      },
      createdAt: now,
    })

    return {
      ok: true as const,
      agentId,
      versionId,
      workspaceSlug: ws.slug,
      scenarioCount: blueprint.scenarios.length,
    }
  })
}
