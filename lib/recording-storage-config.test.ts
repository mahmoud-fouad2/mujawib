import { describe, expect, it } from 'vitest'
import { resolveRecordingStorageConfig } from './recording-storage-config'

const modern = {
  endpoint: 'https://storage.example.com',
  bucket: 'private-recordings',
  accessKeyId: 'access',
  secretAccessKey: 'secret',
}

const legacy = {
  r2AccountId: '0123456789abcdef0123456789abcdef',
  r2Bucket: 'private-recordings',
  r2AccessKeyId: 'access',
  r2SecretAccessKey: 'secret',
}

describe('recording storage configuration', () => {
  it('stays disabled without configuration', () => {
    expect(resolveRecordingStorageConfig({})).toMatchObject({
      enabled: false,
      source: 'none',
      config: null,
    })
  })

  it('uses the current private-storage variables', () => {
    expect(resolveRecordingStorageConfig({ enabled: 'true', ...modern })).toMatchObject({
      enabled: true,
      source: 'recording',
      problem: null,
      config: { ...modern, region: 'auto' },
    })
  })

  it('accepts a complete legacy R2 set when no explicit toggle exists', () => {
    expect(resolveRecordingStorageConfig(legacy)).toMatchObject({
      enabled: true,
      source: 'r2',
      problem: null,
      config: {
        endpoint: `https://${legacy.r2AccountId}.r2.cloudflarestorage.com`,
        bucket: legacy.r2Bucket,
      },
    })
  })

  it('honors an explicit disabled toggle even when R2 is configured', () => {
    expect(resolveRecordingStorageConfig({ enabled: 'false', ...legacy })).toMatchObject({
      enabled: false,
      source: 'none',
      config: null,
    })
  })

  it('fails closed for a partial legacy configuration', () => {
    expect(resolveRecordingStorageConfig({ r2AccountId: legacy.r2AccountId })).toMatchObject({
      enabled: true,
      source: 'r2',
      config: null,
      problem: expect.stringContaining('R2 storage requires'),
    })
  })

  it('fails closed for partial modern values even when legacy values exist', () => {
    expect(
      resolveRecordingStorageConfig({ enabled: 'true', endpoint: modern.endpoint, ...legacy }),
    ).toMatchObject({
      enabled: true,
      source: 'recording',
      config: null,
      problem: expect.stringContaining('Recording storage requires'),
    })
  })
})
