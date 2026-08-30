export type RecordingStorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export type RecordingStorageEnvironment = {
  enabled?: string | undefined
  endpoint?: string | undefined
  region?: string | undefined
  bucket?: string | undefined
  accessKeyId?: string | undefined
  secretAccessKey?: string | undefined
  r2AccountId?: string | undefined
  r2Bucket?: string | undefined
  r2AccessKeyId?: string | undefined
  r2SecretAccessKey?: string | undefined
}

export type RecordingStorageResolution = {
  enabled: boolean
  source: 'recording' | 'r2' | 'none'
  config: RecordingStorageConfig | null
  problem: string | null
}

function present(value: string | undefined) {
  return value?.trim() || undefined
}

/**
 * Resolves the current private-storage variables and the original R2 names.
 * An explicit false always wins; otherwise a complete legacy R2 set opts in.
 */
export function resolveRecordingStorageConfig(
  input: RecordingStorageEnvironment,
): RecordingStorageResolution {
  const modern = {
    endpoint: present(input.endpoint),
    bucket: present(input.bucket),
    accessKeyId: present(input.accessKeyId),
    secretAccessKey: present(input.secretAccessKey),
  }
  const legacy = {
    accountId: present(input.r2AccountId),
    bucket: present(input.r2Bucket),
    accessKeyId: present(input.r2AccessKeyId),
    secretAccessKey: present(input.r2SecretAccessKey),
  }
  const hasModern = Object.values(modern).some(Boolean)
  const hasLegacy = Object.values(legacy).some(Boolean)
  const explicitlyDisabled = input.enabled === 'false'
  const requested = input.enabled === 'true' || (!explicitlyDisabled && (hasModern || hasLegacy))

  if (!requested) {
    return { enabled: false, source: 'none', config: null, problem: null }
  }

  if (hasModern) {
    if (!modern.endpoint || !modern.bucket || !modern.accessKeyId || !modern.secretAccessKey) {
      return {
        enabled: true,
        source: 'recording',
        config: null,
        problem:
          'Recording storage requires endpoint, bucket, access key id, and secret access key',
      }
    }
    return {
      enabled: true,
      source: 'recording',
      config: {
        endpoint: modern.endpoint,
        bucket: modern.bucket,
        accessKeyId: modern.accessKeyId,
        secretAccessKey: modern.secretAccessKey,
        region: present(input.region) ?? 'auto',
      },
      problem: null,
    }
  }

  if (!legacy.accountId || !legacy.bucket || !legacy.accessKeyId || !legacy.secretAccessKey) {
    return {
      enabled: true,
      source: 'r2',
      config: null,
      problem: 'R2 storage requires account id, bucket, access key id, and secret access key',
    }
  }

  return {
    enabled: true,
    source: 'r2',
    config: {
      endpoint: `https://${legacy.accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      bucket: legacy.bucket,
      accessKeyId: legacy.accessKeyId,
      secretAccessKey: legacy.secretAccessKey,
    },
    problem: null,
  }
}
