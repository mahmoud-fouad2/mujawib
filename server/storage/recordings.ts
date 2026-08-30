import 'server-only'

import { randomBytes, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from '@/lib/env'
import {
  type RecordingStorageConfig,
  resolveRecordingStorageConfig,
} from '@/lib/recording-storage-config'

export type StoredRecording = {
  body: NonNullable<Awaited<ReturnType<typeof getObject>>['Body']>
  contentLength: number | undefined
  contentRange: string | undefined
  contentType: string
  etag: string | undefined
}

let client: S3Client | null = null

function resolution() {
  return resolveRecordingStorageConfig({
    enabled: process.env.RECORDING_STORAGE_ENABLED,
    endpoint: env.RECORDING_STORAGE_ENDPOINT,
    region: env.RECORDING_STORAGE_REGION,
    bucket: env.RECORDING_STORAGE_BUCKET,
    accessKeyId: env.RECORDING_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.RECORDING_STORAGE_SECRET_ACCESS_KEY,
    r2AccountId: env.R2_ACCOUNT_ID,
    r2Bucket: env.R2_BUCKET,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
  })
}

export function recordingStorageProblem(): string | null {
  return resolution().problem
}

export function recordingStorageReady(): boolean {
  const resolved = resolution()
  return resolved.enabled && resolved.config !== null
}

function storage() {
  const resolved = resolution()
  const config: RecordingStorageConfig | null = resolved.config
  if (!resolved.enabled || !config) {
    throw new Error('Private recording storage is not configured')
  }

  client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { client, bucket: config.bucket }
}

export async function putRecordingFile(input: {
  objectKey: string
  filePath: string
  contentLength: number
  sha256: string
}) {
  const { client: s3, bucket } = storage()
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      Body: createReadStream(input.filePath),
      ContentLength: input.contentLength,
      ContentType: 'audio/wav',
      CacheControl: 'private, no-store',
      Metadata: {
        schema: 'mujawib-call-recording-v1',
        sha256: input.sha256,
      },
    }),
  )
}

export async function deleteRecording(objectKey: string) {
  const { client: s3, bucket } = storage()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}

async function getObject(objectKey: string, range?: string) {
  const { client: s3, bucket } = storage()
  return s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ...(range ? { Range: range } : {}),
    }),
  )
}

export async function getRecording(objectKey: string, range?: string): Promise<StoredRecording> {
  const object = await getObject(objectKey, range)
  if (!object.Body) throw new Error('Recording object has no body')
  return {
    body: object.Body,
    contentLength: object.ContentLength,
    contentRange: object.ContentRange,
    contentType: object.ContentType ?? 'audio/wav',
    etag: object.ETag,
  }
}

/**
 * Verifies the real object-store permissions, not only that env values exist.
 * The probe is private, random, tiny, and deleted even when verification fails.
 */
export async function verifyRecordingStorageAccess() {
  const { client: s3, bucket } = storage()
  const objectKey = `healthchecks/${randomUUID()}.bin`
  const expected = randomBytes(32)

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: expected,
        ContentLength: expected.byteLength,
        ContentType: 'application/octet-stream',
        CacheControl: 'private, no-store',
      }),
    )
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
    if (!object.Body) throw new Error('Recording storage returned an empty probe body')
    const actual = Buffer.from(await object.Body.transformToByteArray())
    if (!actual.equals(expected)) throw new Error('Recording storage probe did not round-trip')
    return { ok: true as const }
  } finally {
    await s3
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
      .catch(() => undefined)
  }
}
