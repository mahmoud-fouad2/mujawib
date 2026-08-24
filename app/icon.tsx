import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
        color: '#10B981',
        fontSize: '20px',
        fontWeight: 700,
        border: '1px solid #1F2937',
      }}
    >
      م
    </div>,
    { ...size },
  )
}
