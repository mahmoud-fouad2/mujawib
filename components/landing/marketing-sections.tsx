'use client'

import Link from 'next/link'
import { Button, Heading, Label, Stack, Text } from '@primer/react'
import {
  ArrowLeftIcon,
  BroadcastIcon,
  CheckCircleFillIcon,
  CheckCircleIcon,
  CodeIcon,
  CommentDiscussionIcon,
  DeviceMobileIcon,
  GraphIcon,
  HomeIcon,
  LightBulbIcon,
  MegaphoneIcon,
  PeopleIcon,
  PlugIcon,
  RocketIcon,
  ShieldCheckIcon,
  StackIcon,
  UnmuteIcon,
} from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { Surface } from '@/components/surface'
import { Sparkline } from '@/components/sparkline'

function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: 'center' | 'start'
}) {
  return (
    <Stack direction="vertical" gap="condensed" align={align === 'center' ? 'center' : 'start'}>
      {eyebrow ? <Label variant="accent">{eyebrow}</Label> : null}
      <Heading
        as="h2"
        style={{
          fontSize: 'clamp(28px, 3.4vw, 40px)',
          fontWeight: 800,
          textAlign: align,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </Heading>
      {description ? (
        <Text
          size="large"
          style={{
            color: 'var(--fgColor-muted)',
            textAlign: align,
            maxWidth: 560,
            lineHeight: 1.7,
          }}
        >
          {description}
        </Text>
      ) : null}
    </Stack>
  )
}

const SECTORS: { label: string; icon: Icon }[] = [
  { label: 'العيادات', icon: ShieldCheckIcon },
  { label: 'العقارات', icon: HomeIcon },
  { label: 'خدمات السيارات', icon: DeviceMobileIcon },
  { label: 'الاستقبال العام', icon: PeopleIcon },
  { label: 'الخدمات', icon: StackIcon },
]

export function Sectors() {
  return (
    <section id="sectors" style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px' }}>
        <Stack direction="vertical" gap="normal" align="center">
          <SectionHeading
            title="يخدم مختلف القطاعات"
            description="مصمَّم ليتكيّف مع طبيعة عملك — نبدأ من قالب قطاعي جاهز ونضبطه على أنظمتك."
          />
          <Stack direction="horizontal" gap="condensed" wrap="wrap" justify="center">
            {SECTORS.map((s) => {
              const IconComp = s.icon
              return (
                <Surface
                  key={s.label}
                  interactive
                  padding="12px 18px"
                  style={{ display: 'flex' }}
                >
                  <Stack direction="horizontal" gap="condensed" align="center">
                    <span style={{ color: 'var(--fgColor-accent)', display: 'inline-flex' }}>
                      <IconComp size={18} />
                    </span>
                    <Text weight="semibold" size="medium">
                      {s.label}
                    </Text>
                  </Stack>
                </Surface>
              )
            })}
          </Stack>
        </Stack>
      </div>
    </section>
  )
}

const OUTCOMES: { title: string; body: string; icon: Icon }[] = [
  {
    title: 'تقليل المكالمات المفقودة',
    body: 'يجيب في كل مرة، على مدار الساعة، ولا تفوّت أي عميل محتمل.',
    icon: MegaphoneIcon,
  },
  {
    title: 'الحجز الذكي',
    body: 'حجز المواعيد تلقائيًا مع تأكيد فوري وتقليل التعارضات.',
    icon: CheckCircleIcon,
  },
  {
    title: 'التحويل الذكي',
    body: 'يوصل المتصل للقسم أو الموظف المناسب في اللحظة المناسبة.',
    icon: PeopleIcon,
  },
  {
    title: 'متابعة وواتساب',
    body: 'متابعة تلقائية عبر واتساب لرفع نسبة الحضور والرضا.',
    icon: BroadcastIcon,
  },
  {
    title: 'تقارير الجودة',
    body: 'تقارير قصديّة ومؤشرات أداء واضحة لتحسين مستمر.',
    icon: GraphIcon,
  },
]

export function Outcomes() {
  return (
    <section style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        <Stack direction="vertical" gap="spacious">
          <SectionHeading
            align="start"
            eyebrow="النتائج"
            title="نتائج تشغيلية ملموسة"
            description="مُجاوِب يُحدث فرقًا في أرقام عملك اليومية — لا مجرد مؤشرات تقنية."
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 16,
            }}
          >
            {OUTCOMES.map((o) => {
              const IconComp = o.icon
              return (
                <Surface key={o.title} interactive padding={22}>
                  <Stack direction="vertical" gap="normal">
                    <span className="mjw-icon-tile">
                      <IconComp size={22} />
                    </span>
                    <Text weight="semibold" size="large">
                      {o.title}
                    </Text>
                    <Text style={{ color: 'var(--fgColor-muted)', lineHeight: 1.7 }}>{o.body}</Text>
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

const WHY: { title: string; body: string; icon: Icon }[] = [
  {
    title: 'جودة صوت عربية',
    body: 'نموذج صوتي متقدّم يفهم اللهجات العربية وينطق ببطاقة نطق ووضوح.',
    icon: UnmuteIcon,
  },
  {
    title: 'إعداد Agent مضبوط',
    body: 'إعداد احترافي مبني على أفضل ممارسات قطاعك ونبرة علامتك التجارية.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'تكاملات تشغيلية',
    body: 'يتكامل بسلاسة مع أنظمتك الحالية وأدواتك المفضّلة.',
    icon: PlugIcon,
  },
  {
    title: 'مراقبة وتحسين مستمر',
    body: 'نراقب الجودة، نحلّل الأداء، ونقترح تحسينات تلقائيًا.',
    icon: GraphIcon,
  },
]

export function WhyMujawib() {
  return (
    <section style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        <Stack direction="vertical" gap="spacious">
          <SectionHeading align="start" eyebrow="لماذا مُجاوِب؟" title="لماذا مُجاوِب؟" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {WHY.map((w) => {
              const IconComp = w.icon
              return (
                <Surface key={w.title} padding={22} interactive>
                  <Stack direction="vertical" gap="normal">
                    <span className="mjw-icon-tile">
                      <IconComp size={22} />
                    </span>
                    <Text weight="semibold" size="large">
                      {w.title}
                    </Text>
                    <Text style={{ color: 'var(--fgColor-muted)', lineHeight: 1.7 }}>{w.body}</Text>
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

const PREVIEW_POINTS = [
  'كل عمليات الصوت وإدارة العملاء في لوحة واحدة ذكية وسهلة.',
  'رؤية لحظية لأداء المكالمات والحجوزات والمتابعات بسهولة.',
  'تقارير ذكية قابلة للتخصيص حسب مؤشراتك.',
  'صلاحيات دقيقة لفريق العمل.',
]

function MiniDash() {
  const navItems = ['الرئيسية', 'المكالمات', 'الحجوزات', 'المتابعات', 'التقارير', 'الجودة']
  return (
    <div className="mjw-preview-frame">
      {/* window chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderBottom: '1px solid var(--borderColor-muted)',
          background: 'var(--bgColor-inset)',
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <Text size="small" style={{ color: 'var(--fgColor-muted)', marginInlineStart: 'auto' }}>
          لوحة التشغيل — مُجاوِب
        </Text>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', minHeight: 300 }}>
        {/* sidebar */}
        <div
          style={{
            borderInlineStart: '1px solid var(--borderColor-muted)',
            background: 'var(--bgColor-inset)',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {navItems.map((n, i) => (
            <div
              key={n}
              style={{
                fontSize: 12.5,
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? 'var(--fgColor-accent)' : 'var(--fgColor-muted)',
                background: i === 0 ? 'var(--bgColor-accent-muted)' : 'transparent',
                padding: '8px 10px',
                borderRadius: 8,
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* main */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { l: 'المكالمات اليوم', v: '1,248', d: [8, 12, 9, 14, 18, 16, 24] },
              { l: 'معدل الإجابة', v: '98%', d: [10, 13, 11, 16, 15, 20, 22] },
              { l: 'الحجوزات', v: '312', d: [6, 9, 8, 12, 11, 15, 17] },
            ].map((k) => (
              <Surface key={k.l} padding={12}>
                <Stack direction="vertical" gap="none">
                  <Text size="small" style={{ color: 'var(--fgColor-muted)', fontSize: 11 }}>
                    {k.l}
                  </Text>
                  <Text
                    className="mjw-tabular"
                    style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}
                  >
                    {k.v}
                  </Text>
                  <Sparkline data={k.d} width={90} height={22} />
                </Stack>
              </Surface>
            ))}
          </div>

          <Surface padding={14}>
            <Stack direction="vertical" gap="condensed">
              <Text size="small" weight="semibold">
                اتجاه المكالمات
              </Text>
              <div className="mjw-fluid-svg">
                <Sparkline
                  data={[12, 18, 14, 22, 19, 26, 24, 30, 27, 34, 31, 38]}
                  width={460}
                  height={70}
                  strokeWidth={2.25}
                />
              </div>
            </Stack>
          </Surface>
        </div>
      </div>
    </div>
  )
}

export function DashboardPreview() {
  return (
    <section className="mjw-section-tint" style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '84px 24px' }}>
        <div className="mjw-split">
          {/* copy — right in RTL */}
          <Stack direction="vertical" gap="normal">
            <Label variant="accent">لوحة التحكم</Label>
            <Heading
              as="h2"
              style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              لوحة تشغيل متكاملة
            </Heading>
            <Text size="large" style={{ color: 'var(--fgColor-muted)', lineHeight: 1.75, maxWidth: 460 }}>
              كل عمليات الصوت وإدارة العملاء في لوحة واحدة ذكية وسهلة الاستخدام.
            </Text>
            <Stack direction="vertical" gap="condensed" style={{ marginTop: 4 }}>
              {PREVIEW_POINTS.map((p) => (
                <Stack key={p} direction="horizontal" align="start" gap="condensed">
                  <span style={{ color: 'var(--fgColor-accent)', display: 'inline-flex', marginTop: 3 }}>
                    <CheckCircleFillIcon size={16} />
                  </span>
                  <Text style={{ color: 'var(--fgColor-default)', lineHeight: 1.6 }}>{p}</Text>
                </Stack>
              ))}
            </Stack>
            <div style={{ marginTop: 8 }}>
              <Button as={Link} href="/console" variant="primary" size="large" trailingVisual={ArrowLeftIcon}>
                استكشف المنصة
              </Button>
            </div>
          </Stack>

          {/* dashboard mock — left in RTL */}
          <MiniDash />
        </div>
      </div>
    </section>
  )
}

const STEPS: { n: string; title: string; body: string; icon: Icon }[] = [
  {
    n: '01',
    title: 'فهم احتياجك',
    body: 'نحلل طبيعة عملك والجمهور والأهداف الرئيسية لديك.',
    icon: CommentDiscussionIcon,
  },
  {
    n: '02',
    title: 'إعداد وتجهيز',
    body: 'نضبط الـAgent والسيناريوهات وتكامله مع أنظمتك.',
    icon: LightBulbIcon,
  },
  {
    n: '03',
    title: 'اختبار الجودة',
    body: 'نختبر التجربة والجودة الصوتية وسيناريوهات العمل.',
    icon: CheckCircleIcon,
  },
  {
    n: '04',
    title: 'إطلاق ومتابعة',
    body: 'نطلق الخدمة، نتابع الأداء ونحسّن باستمرار.',
    icon: RocketIcon,
  },
]

export function HowItWorks() {
  return (
    <section id="how" style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        <Stack direction="vertical" gap="spacious">
          <SectionHeading align="start" eyebrow="كيف نعمل؟" title="كيف نعمل؟" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 16,
            }}
          >
            {STEPS.map((s) => {
              const IconComp = s.icon
              return (
                <Surface key={s.n} padding={20} interactive>
                  <Stack direction="vertical" gap="normal">
                    <Stack direction="horizontal" align="center" justify="space-between">
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--borderRadius-full)',
                          display: 'grid',
                          placeItems: 'center',
                          background: 'var(--bgColor-accent-emphasis)',
                          color: 'var(--fgColor-onEmphasis)',
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                        className="mjw-tabular"
                      >
                        {s.n}
                      </span>
                      <span style={{ color: 'var(--fgColor-muted)', display: 'inline-flex' }}>
                        <IconComp size={20} />
                      </span>
                    </Stack>
                    <Text weight="semibold" size="large">
                      {s.title}
                    </Text>
                    <Text style={{ color: 'var(--fgColor-muted)', lineHeight: 1.7 }}>{s.body}</Text>
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

const INTEGRATIONS: { title: string; body: string; icon: Icon }[] = [
  { title: 'Google Calendar', body: 'مزامنة المواعيد وإدارة التوافر.', icon: CheckCircleIcon },
  { title: 'WhatsApp', body: 'تواصل ومتابعة تلقائية.', icon: BroadcastIcon },
  { title: 'CRM / API', body: 'ربط مع أنظمتك عبر API آمن.', icon: CodeIcon },
  { title: 'SIP / PBX', body: 'يدعم البنية الهاتفية الخاصة بك.', icon: PlugIcon },
]

export function Integrations() {
  return (
    <section id="integrations" style={{ borderBottom: '1px solid var(--borderColor-muted)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px' }}>
        <Stack direction="vertical" gap="spacious">
          <SectionHeading
            align="start"
            eyebrow="التكاملات"
            title="تكاملات جاهزة"
            description="يتصل بما تستخدمه يوميًا — دون بناء بنية تقنية من الصفر."
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {INTEGRATIONS.map((it) => {
              const IconComp = it.icon
              return (
                <Surface key={it.title} padding={18} interactive>
                  <Stack direction="horizontal" gap="normal" align="center">
                    <span className="mjw-icon-tile" style={{ flexShrink: 0 }}>
                      <IconComp size={20} />
                    </span>
                    <Stack direction="vertical" gap="none">
                      <Text weight="semibold" style={{ direction: 'ltr', textAlign: 'right' }}>
                        {it.title}
                      </Text>
                      <Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
                        {it.body}
                      </Text>
                    </Stack>
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
