import fs from 'node:fs'
import path from 'node:path'
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const logoBuffer = fs.readFileSync(
    path.join(process.cwd(), 'public/images/brand/logo-mark-ink.png'),
  )
  const base64 = `data:image/png;base64,${logoBuffer.toString('base64')}`

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0B0D10 0%, #161A22 100%)',
        borderRadius: '36px',
        padding: '20px',
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: Satori ImageResponse requires standard img element */}
      <img
        src={base64}
        alt="مُجاوِب"
        style={{
          width: '140px',
          height: '140px',
          objectFit: 'contain',
        }}
      />
    </div>,
    { ...size },
  )
}
