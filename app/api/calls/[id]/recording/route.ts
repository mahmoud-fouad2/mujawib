import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { recordingPolicyAllowsCapture } from '@/lib/recording-policy'
import { authorizeClientWorkspace, authorizeOperator } from '@/server/auth/access'
import { db } from '@/server/db'
import { call, workspace } from '@/server/db/schema'
import { parseByteRange } from '@/server/storage/http-range'
import { getRecording } from '@/server/storage/recordings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function privateHeaders(input: {
  callId: string
  contentType: string
  contentLength: number
  contentRange?: string | undefined
  etag?: string | undefined
}) {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `inline; filename="mujawib-call-${input.callId}.wav"`,
    'Content-Length': String(input.contentLength),
    'Content-Type': input.contentType,
    'X-Content-Type-Options': 'nosniff',
  })
  if (input.contentRange) headers.set('Content-Range', input.contentRange)
  if (input.etag) headers.set('ETag', input.etag)
  return headers
}

async function authorizedRecording(callId: string) {
  const [row] = await db
    .select({
      id: call.id,
      workspaceId: call.workspaceId,
      objectKey: call.recordingObjectKey,
      status: call.recordingStatus,
      contentType: call.recordingContentType,
      byteSize: call.recordingByteSize,
      recordingEnabled: workspace.recordingEnabled,
      disclosureMode: workspace.recordingDisclosureMode,
      approvedAt: workspace.recordingApprovedAt,
    })
    .from(call)
    .innerJoin(workspace, eq(call.workspaceId, workspace.id))
    .where(eq(call.id, callId))
    .limit(1)

  if (
    !row?.objectKey?.startsWith('recordings/v1/') ||
    (row.status !== 'ready' && row.status !== 'partial') ||
    !row.byteSize
  ) {
    return null
  }
  if (
    !recordingPolicyAllowsCapture({
      enabled: row.recordingEnabled,
      disclosureMode: row.disclosureMode,
      approvedAt: row.approvedAt,
    })
  ) {
    return null
  }

  const authorized = {
    ...row,
    objectKey: row.objectKey,
    byteSize: row.byteSize,
  }

  const [operator, client] = await Promise.all([
    authorizeOperator('recording.listen'),
    authorizeClientWorkspace(row.workspaceId, 'recording.listen'),
  ])
  return operator || client ? authorized : null
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const recording = await authorizedRecording(id)
  if (!recording) return new Response(null, { status: 404 })

  const range = parseByteRange(request.headers.get('range'), recording.byteSize)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${recording.byteSize}`,
      },
    })
  }

  try {
    const object = await getRecording(recording.objectKey, range?.header)
    const contentLength = object.contentLength ?? range?.length ?? recording.byteSize
    const contentRange =
      object.contentRange ??
      (range ? `bytes ${range.start}-${range.end}/${recording.byteSize}` : undefined)
    return new Response(object.body.transformToWebStream(), {
      status: range ? 206 : 200,
      headers: privateHeaders({
        callId: recording.id,
        contentType: recording.contentType ?? object.contentType,
        contentLength,
        ...(contentRange ? { contentRange } : {}),
        ...(object.etag ? { etag: object.etag } : {}),
      }),
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}

export async function HEAD(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const recording = await authorizedRecording(id)
  if (!recording) return new Response(null, { status: 404 })

  return new Response(null, {
    status: 200,
    headers: privateHeaders({
      callId: recording.id,
      contentType: recording.contentType ?? 'audio/wav',
      contentLength: recording.byteSize,
    }),
  })
}
