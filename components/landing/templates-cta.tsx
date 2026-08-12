'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button, Heading, Label, Stack, Text } from '@primer/react'
import {
  ArrowLeftIcon,
  DeviceMobileIcon,
  HomeIcon,
  PeopleIcon,
  ShieldCheckIcon,
} from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { Surface } from '@/components/surface'
import { MujawibMark } from '@/components/mujawib-mark'
import { Waveform } from '@/components/waveform'

const TEMPLATES: {
  title: string
  body: string
  image: string
  icon: Icon
}[] = [
  {
    title: 'العيادات',
    body: 'حجز المواعيد، تذكير المرضى، والرد على الاستفسارات الطبية.',
    image: '/templates/clinic.png',
    icon: ShieldCheckIcon,
  },
  {
    title: 'العقارات',
    body: 'استقبال العملاء، عرض العقارات، وتحديد المعاينات.',
    image: '/templates/realestate.png',
    icon: HomeIcon,
  },
  {
    title: 'خدمات السيارات',
    body: 'حجز الصيانة، متابعة الطلبات، وتذكير العملاء.',
    image: '/templates/cars.png',
    icon: DeviceMobileIcon,
  },
  {
    title: 'الاستقبال العام',
    body: 'الرد على المكالمات، تابع الأداء، وحوّلها للقسم المناسب.',
    image: '/templates/reception.png',
    icon: PeopleIcon,
  },
]

export function Templates() {
  return (
    <section style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        <Stack direction="vertical" gap="spacious">
          <Stack direction="vertical" gap="condensed">
            <Label variant="accent">القوالب</Label>
            <Heading as="h2" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em' }}>
              قوالب جاهزة للقطاعات
            </Heading>
            <Text size="large" style={{ color: 'var(--fgColor-muted)', maxWidth: 560, lineHeight: 1.7 }}>
              ابدأ بسرعة بنموذج يناسب عملك — جاهز للتخصيص على أنظمتك.
            </Text>
          </Stack>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 16,
            }}
          >
            {TEMPLATES.map((t) => {
              const IconComp = t.icon
              return (
                <Surface key={t.title} padding={0} interactive style={{ overflow: 'hidden' }}>
                  <div style={{ position: 'relative', height: 150 }}>
                    <Image
                      src={t.image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      style={{ objectFit: 'cover' }}
                    />
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--bgColor-default) 88%, transparent) 100%)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        insetInlineStart: 12,
                        top: 12,
                        width: 34,
                        height: 34,
                        borderRadius: 'var(--borderRadius-medium)',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--bgColor-accent-emphasis)',
                        color: 'var(--fgColor-onEmphasis)',
                      }}
                    >
                      <IconComp size={18} />
                    </span>
                  </div>
                  <Stack direction="vertical" gap="condensed" padding="normal">
                    <Text weight="semibold" size="large">
                      {t.title}
                    </Text>
                    <Text size="small" style={{ color: 'var(--fgColor-muted)', lineHeight: 1.7 }}>
                      {t.body}
                    </Text>
                    <Button as={Link} href="/console" variant="invisible" trailingVisual={ArrowLeftIcon} size="small">
                      عرض القالب
                    </Button>
                  </Stack>
                </Surface>
              )
            })}
          </div>
        </Stack>
      </div>
    </section>
  )
}

export function CtaBanner() {
  return (
    <section id="contact">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 26,
            padding: '56px 44px',
            background:
              'radial-gradient(120% 140% at 15% 0%, rgba(140,110,255,0.5) 0%, transparent 55%), linear-gradient(135deg, #16143a 0%, #0d0c22 60%, #0a0a18 100%)',
            border: '1px solid rgba(150,140,255,0.2)',
            boxShadow: '0 40px 90px -50px rgba(80,60,220,0.7)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetInlineEnd: '-8%',
              top: '-70%',
              width: 560,
              height: 560,
              background: 'radial-gradient(circle, rgba(124,108,255,0.5) 0%, transparent 66%)',
              filter: 'blur(14px)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(120% 100% at 100% 0%, #000 10%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(120% 100% at 100% 0%, #000 10%, transparent 70%)',
            }}
          />
          <Stack
            direction={{ narrow: 'vertical', wide: 'horizontal' }}
            align="center"
            justify="space-between"
            gap="spacious"
            style={{ position: 'relative' }}
          >
            <Stack direction="vertical" gap="condensed">
              <Heading
                as="h2"
                style={{ fontSize: 32, fontWeight: 700, color: 'var(--fgColor-onEmphasis)', lineHeight: 1.3 }}
              >
                جاهز لتحويل رقم شركتك إلى
                <br />
                موظف استقبال ذكي؟
              </Heading>
              <Text style={{ color: 'color-mix(in srgb, var(--fgColor-onEmphasis) 78%, transparent)' }}>
                تجربة مجانية — بدون بطاقة ائتمان.
              </Text>
            </Stack>
            <Stack direction="vertical" gap="normal" align="center">
              <Waveform bars={22} height={30} live color="var(--fgColor-onEmphasis)" />
              <Button as={Link} href="/console" variant="primary" size="large" trailingVisual={ArrowLeftIcon}>
                احجز عرضًا تجريبيًا الآن
              </Button>
            </Stack>
          </Stack>
        </div>
      </div>
    </section>
  )
}

const FOOTER_COLS: { title: string; links: string[] }[] = [
  { title: 'الحلول', links: ['إدارة المكالمات', 'الحجوزات الذكية', 'متابعة العملاء', 'تقارير الجودة'] },
  { title: 'القطاعات', links: ['العيادات', 'العقارات', 'خدمات السيارات', 'الاستقبال العام'] },
  { title: 'الشركة', links: ['من نحن', 'المدونة', 'الشركاء', 'المسيرة المهنية'] },
]

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--borderColor-muted)', background: 'var(--bgColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 28px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 1.4fr) repeat(3, minmax(140px, 1fr))',
            gap: 32,
          }}
        >
          <Stack direction="vertical" gap="normal">
            <MujawibMark size={22} />
            <Text size="small" style={{ color: 'var(--fgColor-muted)', lineHeight: 1.8, maxWidth: 280 }}>
              منصة صوتية عربية ذكية لإدارة المكالمات وتحويل تجربة عملائك إلى تجربة استثنائية،
              بجودة عربية احترافية.
            </Text>
            <Stack direction="horizontal" gap="condensed" align="center">
              <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
                hello@mujawib.ai
              </Text>
              <Text size="small" style={{ color: 'var(--fgColor-muted)', direction: 'ltr' }}>
                +966 920 013 030
              </Text>
            </Stack>
          </Stack>

          {FOOTER_COLS.map((col) => (
            <Stack key={col.title} direction="vertical" gap="condensed">
              <Text weight="semibold" size="small">
                {col.title}
              </Text>
              {col.links.map((l) => (
                <a
                  key={l}
                  href="#"
                  style={{ color: 'var(--fgColor-muted)', textDecoration: 'none', fontSize: 14 }}
                >
                  {l}
                </a>
              ))}
            </Stack>
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px solid var(--borderColor-muted)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
            © 2027 مُجاوِب. جميع الحقوق محفوظة.
          </Text>
          <Stack direction="horizontal" gap="normal">
            <a href="#" style={{ color: 'var(--fgColor-muted)', textDecoration: 'none', fontSize: 14 }}>
              سياسة الخصوصية
            </a>
            <a href="#" style={{ color: 'var(--fgColor-muted)', textDecoration: 'none', fontSize: 14 }}>
              الشروط والأحكام
            </a>
          </Stack>
        </div>
      </div>
    </footer>
  )
}
