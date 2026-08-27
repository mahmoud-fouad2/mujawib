import 'server-only'

import { createReadStream } from 'node:fs'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

type RecordingStorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export type StoredRecording = {
  body: NonNullable<Awaited<ReturnType<typeof getObject>>['Body']>
  contentLength: number | undefined
  contentRange: string | undefined
  contentType: string
  etag: string | undefined
}

let client: S3Client | null = null

function configuredValues(): RecordingStorageConfig | null {
  const endpoint = env.RECORDING_STORAGE_ENDPOINT
  const bucket = env.RECORDING_STORAGE_BUCKET
  const accessKeyId = env.RECORDING_STORAGE_ACCESS_KEY_ID
  const secretAccessKey = env.RECORDING_STORAGE_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  return {
    endpoint,
    region: env.RECORDING_STORAGE_REGION,
    bucket,
    accessKeyId,
    secretAccessKey,
  }
}

export function recordingStorageProblem(): string | null {
  if (env.RECORDING_STORAGE_ENABLED !== 'true') return null
  return configuredValues()
    ? null
    : 'RECORDING_STORAGE_ENABLED requires endpoint, bucket, access key id, and secret access key'
}

export function recordingStorageReady(): boolean {
  return env.RECORDING_STORAGE_ENABLED === 'true' && configuredValues() !== null
}

function storage() {
  const config = configuredValues()
  if (env.RECORDING_STORAGE_ENABLED !== 'true' || !config) {
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
