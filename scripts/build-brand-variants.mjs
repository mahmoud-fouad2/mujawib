import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')

const assets = [
  { source: 'logo-horizontal-hq.png', stem: 'logo-horizontal', markOnly: false },
  { source: 'logo-mark.png', stem: 'logo-mark', markOnly: true },
]

const themes = [
  { suffix: 'ink', base: [16, 19, 24] },
  { suffix: 'paper', base: [247, 249, 252] },
]

const voiceBlue = [20, 116, 255]

function components(data, width, height) {
  const visited = new Uint8Array(width * height)
  const found = []

  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index] || data[index * 4 + 3] < 160) continue

    const queue = [index]
    const pixels = []
    visited[index] = 1
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]
      if (current === undefined) continue
      pixels.push(current)
      const x = current % width
      const y = Math.floor(current / width)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      const neighbours = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ]
      for (const neighbour of neighbours) {
        if (neighbour < 0 || visited[neighbour] || data[neighbour * 4 + 3] < 160) continue
        visited[neighbour] = 1
        queue.push(neighbour)
      }
    }

    found.push({ pixels, minX, maxX, minY, maxY })
  }

  return found
}

for (const asset of assets) {
  const input = resolve(root, 'public', 'images', 'brand', asset.source)
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const groups = components(data, info.width, info.height)
  const xLimit = info.width * (asset.markOnly ? 0.66 : 0.22)
  const waveform = groups.filter((group) => {
    const centerX = (group.minX + group.maxX) / 2
    const centerY = (group.minY + group.maxY) / 2
    const groupWidth = group.maxX - group.minX + 1
    const groupHeight = group.maxY - group.minY + 1
    return (
      centerX < xLimit &&
      centerY > info.height * 0.25 &&
      centerY < info.height * 0.76 &&
      groupWidth < info.width * (asset.markOnly ? 0.22 : 0.07) &&
      groupHeight < info.height * 0.48
    )
  })
  const waveformPixels = new Set(waveform.flatMap((group) => group.pixels))

  for (const theme of themes) {
    const output = Buffer.from(data)
    for (let index = 0; index < info.width * info.height; index += 1) {
      const alpha = output[index * 4 + 3]
      if (alpha < 160) {
        output[index * 4 + 3] = 0
        continue
      }
      output[index * 4 + 3] = Math.min(255, Math.round(((alpha - 160) / 64) * 255))
      const color = waveformPixels.has(index) ? voiceBlue : theme.base
      output[index * 4] = color[0]
      output[index * 4 + 1] = color[1]
      output[index * 4 + 2] = color[2]
    }

    await sharp(output, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(resolve(root, 'public', 'images', 'brand', `${asset.stem}-${theme.suffix}.png`))
  }
}

console.log('Built theme-aware MUJAWIB logo variants.')
