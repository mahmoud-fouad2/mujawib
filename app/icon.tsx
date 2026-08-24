import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
        background: '#0B0D10',
        borderRadius: '8px',
        padding: '2px',
      }}
    >
      <img
        src={base64}
        alt="مُجاوِب"
        style={{
          width: '26px',
          height: '26px',
          objectFit: 'contain',
        }}
      />
    </div>,
    { ...size },
  )
}
