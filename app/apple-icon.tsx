import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0B0D10 0%, #111827 100%)',
        borderRadius: '36px',
        color: '#10B981',
        fontSize: '96px',
        fontWeight: 700,
        border: '2px solid #374151',
      }}
    >
      م
    </div>,
    { ...size },
  )
}
