import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { composePcmuWav } from './recording-audio'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('composePcmuWav', () => {
  it('creates a valid mono PCM WAV and preserves timeline silence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mujawib-audio-test-'))
    roots.push(root)
    const source = path.join(root, 'caller.pcmu')
    const output = path.join(root, 'call.wav')
    await writeFile(source, Buffer.from([0x80, 0x80]))

    const result = await composePcmuWav({
      segments: [{ path: source, startSample: 2, samples: 2, track: 'caller' }],
      maxSamples: 100,
      outputPath: output,
    })
    const wav = await readFile(output)

    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(8_000)
    expect(wav.readInt16LE(44)).toBe(0)
    expect(wav.readInt16LE(46)).toBe(0)
    expect(wav.readInt16LE(48)).toBeGreaterThan(30_000)
    expect(result.byteSize).toBe(52)
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('mixes overlapping caller and agent samples without clipping', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mujawib-audio-test-'))
    roots.push(root)
    const caller = path.join(root, 'caller.pcmu')
    const agent = path.join(root, 'agent.pcmu')
    const output = path.join(root, 'call.wav')
    await Promise.all([
      writeFile(caller, Buffer.from([0x00])),
      writeFile(agent, Buffer.from([0x80])),
    ])

    await composePcmuWav({
      segments: [
        { path: caller, startSample: 0, samples: 1, track: 'caller' },
        { path: agent, startSample: 0, samples: 1, track: 'agent' },
      ],
      maxSamples: 100,
      outputPath: output,
    })
    const wav = await readFile(output)
    expect(Math.abs(wav.readInt16LE(44))).toBeLessThanOrEqual(1)
  })
})
