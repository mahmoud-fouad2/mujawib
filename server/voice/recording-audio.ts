import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'

export const PCMU_SAMPLE_RATE = 8_000
const WAV_HEADER_BYTES = 44
const MIX_CHUNK_SAMPLES = PCMU_SAMPLE_RATE

export type PcmuAudioSegment = {
  path: string
  startSample: number
  samples: number
  track: 'caller' | 'agent'
}

function decodePcmu(value: number): number {
  const mu = ~value & 0xff
  let sample = ((mu & 0x0f) << 3) + 0x84
  sample <<= (mu & 0x70) >> 4
  return mu & 0x80 ? 0x84 - sample : sample - 0x84
}

function wavHeader(samples: number) {
  const dataBytes = samples * 2
  const header = Buffer.alloc(WAV_HEADER_BYTES)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(PCMU_SAMPLE_RATE, 24)
  header.writeUInt32LE(PCMU_SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)
  return header
}

export async function composePcmuWav(input: {
  segments: PcmuAudioSegment[]
  maxSamples: number
  outputPath: string
}) {
  if (input.segments.length === 0) throw new Error('no_audio_captured')
  const maxEnd = Math.max(...input.segments.map((segment) => segment.startSample + segment.samples))
  const totalSamples = Math.min(input.maxSamples, maxEnd)
  if (totalSamples <= 0) throw new Error('no_audio_captured')

  const output = await open(input.outputPath, 'w')
  const sources = await Promise.all(
    input.segments.map(async (segment) => ({ segment, file: await open(segment.path, 'r') })),
  )
  const hash = createHash('sha256')

  try {
    const header = wavHeader(totalSamples)
    await output.write(header, 0, header.length, 0)
    hash.update(header)

    for (let chunkStart = 0; chunkStart < totalSamples; chunkStart += MIX_CHUNK_SAMPLES) {
      const chunkSamples = Math.min(MIX_CHUNK_SAMPLES, totalSamples - chunkStart)
      const sum = new Int32Array(chunkSamples)
      const contributors = new Uint8Array(chunkSamples)

      for (const source of sources) {
        const segmentStart = source.segment.startSample
        const segmentEnd = Math.min(totalSamples, segmentStart + source.segment.samples)
        const overlapStart = Math.max(chunkStart, segmentStart)
        const overlapEnd = Math.min(chunkStart + chunkSamples, segmentEnd)
        if (overlapEnd <= overlapStart) continue

        const length = overlapEnd - overlapStart
        const encoded = Buffer.allocUnsafe(length)
        const { bytesRead } = await source.file.read(
          encoded,
          0,
          length,
          overlapStart - segmentStart,
        )
        const targetOffset = overlapStart - chunkStart
        for (let i = 0; i < bytesRead; i += 1) {
          const target = targetOffset + i
          sum[target] = (sum[target] ?? 0) + decodePcmu(encoded[i] ?? 0xff)
          contributors[target] = (contributors[target] ?? 0) + 1
        }
      }

      const pcm = Buffer.alloc(chunkSamples * 2)
      for (let i = 0; i < chunkSamples; i += 1) {
        const count = contributors[i] ?? 0
        const mixed = count > 0 ? Math.round((sum[i] ?? 0) / count) : 0
        pcm.writeInt16LE(Math.max(-32_768, Math.min(32_767, mixed)), i * 2)
      }
      await output.write(pcm, 0, pcm.length, WAV_HEADER_BYTES + chunkStart * 2)
      hash.update(pcm)
    }
  } finally {
    await Promise.allSettled(sources.map((source) => source.file.close()))
    await output.close()
  }

  return {
    byteSize: WAV_HEADER_BYTES + totalSamples * 2,
    sha256: hash.digest('hex'),
    durationSeconds: totalSamples / PCMU_SAMPLE_RATE,
  }
}
