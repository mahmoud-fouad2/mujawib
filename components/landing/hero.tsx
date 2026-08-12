'use client'

import { Button, Heading, Stack, Text } from '@primer/react'
import { MarketingButton } from '@/components/material/marketing-button'
import {
  ArrowLeftIcon,
  CheckCircleFillIcon,
  UnmuteIcon,
  XIcon,
} from '@primer/octicons-react'
import { Waveform } from '@/components/waveform'
import { Sparkline } from '@/components/sparkline'

export function Hero() {
  return (
    <section id="product" className="mjw-hero">
      {/* decorative light beams */}
      <div aria-hidden="true" className="mjw-hero-beam" style={{ top: '30%' }} />
      <div aria-hidden="true" className="mjw-hero-beam" style={{ top: '52%', opacity: 0.4 }} />
      <div aria-hidden="true" className="mjw-hero-beam" style={{ top: '68%', opacity: 0.5 }} />

      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '96px 24px 104px' }}>
        <div className="mjw-hero-grid">
          {/* Copy — appears on the right in RTL */}
          <div>
            <Stack direction="vertical" gap="normal">
              <span className="mjw-badge">
                <span
                  className="mjw-pulse-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#7ee787',
                    animation: 'mjw-pulse 1.4s ease-in-out infinite',
                  }}
                />
                منصة تشغيل صوتي عربي • B2B مُدارة
              </span>

              <Heading
                as="h1"
                style={{
                  fontSize: 'clamp(40px, 5.4vw, 66px)',
                  lineHeight: 1.05,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#f6f5ff',
                  margin: '4px 0',
                }}
              >
                صوت عربي
                <br />
                يفهم و
                <span
                  style={{
                    background: 'linear-gradient(120deg, #b3a6ff, #7c8cff)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  يُنجز
                </span>
              </Heading>

              <Text
                size="large"
                style={{
                  color: 'rgba(233, 231, 255, 0.72)',
                  lineHeight: 1.75,
                  maxWidth: 480,
                  fontSize: 18,
                }}
              >
                منصة صوتية ذكية لإدارة المكالمات، الحجوزات، الاستفسارات، والتحويل للموظفين
                بجودة عربية احترافية — إعداد Agent مضبوط وربط فعلي بأنظمتك.
              </Text>

              <Stack direction="horizontal" gap="condensed" wrap="wrap" style={{ marginTop: 10 }}>
                <MarketingButton href="/console" endIcon={<ArrowLeftIcon size={18} />}>
                  احجز عرضًا تجريبيًا
                </MarketingButton>
                <Button
                  size="large"
                  leadingVisual={UnmuteIcon}
                  variant="invisible"
                  style={{
                    color: '#e9e7ff',
                    border: '1px solid rgba(160,150,255,0.28)',
                  }}
                >
                  استمع إلى تجربة
                </Button>
              </Stack>

              {/* trust row */}
              <Stack direction="horizontal" gap="normal" wrap="wrap" style={{ marginTop: 14 }}>
                {['بدون بطاقة ائتمان', 'إطلاق سريع', 'دعم عربي مخصّص'].map((t) => (
                  <Stack key={t} direction="horizontal" align="center" gap="condensed">
                    <span style={{ color: '#9b8fff', display: 'inline-flex' }}>
                      <CheckCircleFillIcon size={15} />
                    </span>
                    <Text size="small" style={{ color: 'rgba(233,231,255,0.7)' }}>
                      {t}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </div>

          {/* Visual — device + floating stat cards */}
          <div className="mjw-hero-visual">
            <FloatingStat
              className="mjw-hero-stat-1"
              label="معدل الإجابة"
              value="98%"
              data={[10, 13, 11, 16, 15, 20, 22]}
            />
            <FloatingStat
              className="mjw-hero-stat-2"
              label="المكالمات اليوم"
              value="1,248"
              data={[8, 12, 9, 14, 18, 16, 24]}
            />
            <FloatingStat
              className="mjw-hero-stat-3"
              label="معدل الحجز الناجح"
              value="92%"
              data={[12, 10, 15, 14, 19, 18, 23]}
            />
            <CallMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

function FloatingStat({
  label,
  value,
  data,
  className,
}: {
  label: string
  value: string
  data: number[]
  className?: string
}) {
  return (
    <div className={`mjw-hero-stat ${className ?? ''}`} style={{ minWidth: 150 }}>
      <Stack direction="vertical" gap="condensed">
        <Text size="small" style={{ color: 'rgba(233,231,255,0.62)' }}>
          {label}
        </Text>
        <Stack direction="horizontal" align="center" justify="space-between" gap="condensed">
          <Text
            className="mjw-tabular"
            style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: '#fff' }}
          >
            {value}
          </Text>
          <Sparkline data={data} width={62} height={26} stroke="#a99cff" />
        </Stack>
      </Stack>
    </div>
  )
}

function CallMockup() {
  return (
    <div style={{ position: 'relative', zIndex: 2, width: 400, maxWidth: '100%' }}>
      {/* glow halo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: -30,
          background: 'radial-gradient(circle, rgba(120,100,255,0.35), transparent 68%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          borderRadius: 26,
          padding: 1,
          background: 'linear-gradient(160deg, rgba(150,130,255,0.6), rgba(90,110,255,0.15) 55%, transparent)',
          boxShadow: '0 50px 90px -40px rgba(0,0,0,0.85)',
        }}
      >
        <div
          style={{
            borderRadius: 25,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #14142e, #0e0e20)',
            border: '1px solid rgba(150,140,255,0.14)',
          }}
        >
          {/* header */}
          <Stack
            direction="horizontal"
            align="center"
            justify="space-between"
            style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Stack direction="horizontal" align="center" gap="condensed">
              <span
                className="mjw-pulse-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#7ee787',
                  animation: 'mjw-pulse 1.4s ease-in-out infinite',
                }}
              />
              <Text weight="semibold" size="small" style={{ color: '#f0eeff' }}>
                مكالمة واردة
              </Text>
            </Stack>
            <Text className="mjw-tabular" style={{ color: 'rgba(233,231,255,0.6)', fontSize: 13 }}>
              00:01:24
            </Text>
          </Stack>

          {/* waveform */}
          <div style={{ padding: '30px 18px 22px' }}>
            <Waveform bars={40} height={58} live color="#9b8fff" />
            <Text
              as="p"
              size="medium"
              style={{ marginTop: 18, textAlign: 'center', lineHeight: 1.7, color: '#e9e7ff' }}
            >
              «أهلًا بك في مُجاوِب، كيف يمكنني مساعدتك؟»
            </Text>
          </div>

          {/* live analysis */}
          <div style={{ padding: '0 18px 18px' }}>
            <div
              style={{
                borderRadius: 14,
                padding: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Stack direction="vertical" gap="condensed">
                <Text size="small" style={{ color: 'rgba(233,231,255,0.55)' }}>
                  تحليل فوري
                </Text>
                <AnalysisRow label="نية المتصل" value="حجز موعد" tone="#a99cff" />
                <AnalysisRow label="المشاعر" value="إيجابي" tone="#7ee787" />
                <AnalysisRow label="أولوية المكالمة" value="متوسطة" tone="#f0b429" />
              </Stack>
            </div>
          </div>

          {/* controls */}
          <Stack
            direction="horizontal"
            align="center"
            justify="center"
            gap="normal"
            style={{ padding: '4px 18px 24px' }}
          >
            <ControlButton icon={<UnmuteIcon size={18} />} label="كتم" />
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(150deg, #7c6cff, #5b4cf0)',
                color: '#fff',
                boxShadow: '0 16px 34px -12px rgba(109,94,252,0.9)',
              }}
              aria-hidden="true"
            >
              <UnmuteIcon size={22} />
            </div>
            <ControlButton icon={<XIcon size={18} />} label="إنهاء" danger />
          </Stack>
        </div>
      </div>
    </div>
  )
}

function AnalysisRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Stack direction="horizontal" align="center" justify="space-between">
      <Text size="small" style={{ color: 'rgba(233,231,255,0.6)' }}>
        {label}
      </Text>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: tone,
          padding: '3px 10px',
          borderRadius: 999,
          background: `color-mix(in srgb, ${tone} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
        }}
      >
        {value}
      </span>
    </Stack>
  )
}

function ControlButton({
  icon,
  label,
  danger,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
}) {
  return (
    <div
      aria-label={label}
      role="img"
      style={{
        width: 46,
        height: 46,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        color: danger ? '#ff7b72' : 'rgba(233,231,255,0.75)',
      }}
    >
      {icon}
    </div>
  )
}
