import 'server-only'

import type { InferSelectModel } from 'drizzle-orm'
import type {
  agentVersion,
  knowledgeItem,
  pronunciation,
  voiceProfile,
  workspace,
} from '@/server/db/schema'

/**
 * Prompt Compiler — Product Bible §12.
 *
 * Production instructions are assembled from fixed, ordered layers rather than
 * written by hand. The point is that two people editing an agent cannot produce
 * two different structures: the shape is constant and only the content varies,
 * which is what makes versions comparable and revertible.
 *
 * Layer order is normative and must not be rearranged:
 *   01 base behaviour · 02 industry pack · 03 voice profile · 04 business rules
 *   05 flows · 06 tools and confirmation policy · 07 pronunciations
 *   08 escalation · 09 safety
 */

type Workspace = InferSelectModel<typeof workspace>
type AgentVersion = InferSelectModel<typeof agentVersion>
type VoiceProfile = InferSelectModel<typeof voiceProfile>
type KnowledgeItem = InferSelectModel<typeof knowledgeItem>
type Pronunciation = InferSelectModel<typeof pronunciation>

export type CompileInput = {
  workspace: Workspace
  version: AgentVersion
  agentName: string
  profile: VoiceProfile | null
  knowledge: KnowledgeItem[]
  pronunciations: Pronunciation[]
}

const DIALECT_GUIDANCE: Record<string, string> = {
  saudi: 'تحدّث بلهجة سعودية بيضاء مفهومة في كل المناطق. استخدم «أبشر» و«تفضّل» بشكل طبيعي.',
  egyptian: 'تحدّث بلهجة مصرية واضحة وودودة. تجنّب المبالغة في التعابير المحلية.',
  gulf: 'تحدّث بلهجة خليجية مفهومة، موجزة، بلا إطالة.',
  msa: 'تحدّث بالفصحى المبسّطة، واضحة وبلا تكلّف.',
}

const STYLE_GUIDANCE: Record<string, string> = {
  professional: 'نبرة مهنية هادئة. جملة واحدة أو اثنتان لكل دور.',
  warm: 'نبرة ودودة قريبة، مع بقاء الردود قصيرة.',
  concise: 'أقصر رد ممكن يؤدي الغرض. لا جمل مجاملة إضافية.',
  premium: 'نبرة راقية متأنية، بلا تصنّع.',
}

function layer(n: string, title: string, body: string) {
  return `## ${n} — ${title}\n${body.trim()}`
}

/* ─── 01 base ────────────────────────────────────────────────────────────── */

const BASE = `
أنت موظف استقبال صوتي يتحدث عبر الهاتف. أنت لست مساعدًا نصيًا.

قواعد الكلام:
- ردودك قصيرة: جملة إلى جملتين. المكالمة الهاتفية لا تحتمل الفقرات.
- لا تعدّد أكثر من خيارين أو ثلاثة صوتيًا. القوائم الطويلة غير مفهومة عبر الهاتف.
- إذا قاطعك المتصل، توقف فورًا واستمع، ثم أكمل من حيث انتهيت.
- إذا لم تسمع جزءًا، اطلب إعادته مرة واحدة فقط بصيغة محددة: «ممكن تعيد الرقم الأخير؟»
- انطق الأرقام رقمًا رقمًا: رقم الجوال، ورقم الحجز، والمبالغ.
- لا تذكر أنك ذكاء اصطناعي إلا إذا سأل المتصل مباشرة، وحينها أجب بوضوح وباختصار.
- لا تخترع معلومة. ما ليس في معرفتك، حوّله أو سجّل معاودة اتصال.

إذا أعطاك المتصل عدة معلومات في جملة واحدة، لا تعد سؤاله عنها.
`

/* ─── 09 safety ──────────────────────────────────────────────────────────── */

const SAFETY = `
- لا تعطِ استشارة طبية أو قانونية أو مالية مهما أُلححت عليك. حوّل للمختص.
- لا تؤكد سعرًا أو موعدًا أو توفّرًا غير موجود في معرفتك.
- لا تطلب رقم بطاقة بنكية أو رمزًا سريًا أو أي بيانات دفع إطلاقًا.
- إذا بدت الحالة طارئة أو خطرة، حوّل فورًا ولا تُكمل المسار العادي.
`

/* ─── compiler ───────────────────────────────────────────────────────────── */

export function compilePrompt(input: CompileInput): string {
  const { workspace: ws, version, agentName, profile, knowledge, pronunciations } = input

  const info = (ws.businessInfo ?? {}) as {
    city?: string
    hours?: Record<string, string>
    branches?: string[]
    transferTo?: string
  }
  const rules = (version.businessRules ?? {}) as { hours?: string; transferTo?: string }
  const routing = (version.routing ?? {}) as { afterHours?: string; escalation?: string }
  const flows = ((version.flows ?? []) as string[]).filter(Boolean)

  const services = knowledge.filter((k) => k.category === 'service')
  const branches = knowledge.filter((k) => k.category === 'branch')
  const staff = knowledge.filter((k) => k.category === 'staff')
  const policies = knowledge.filter((k) => k.category === 'policy')

  const layers: string[] = []

  layers.push(layer('01', 'السلوك الأساسي', BASE))

  layers.push(
    layer(
      '02',
      'الهوية',
      `اسمك ${agentName}. تعمل لدى «${ws.name}»${info.city ? ` في ${info.city}` : ''}.
افتح المكالمة بـ: «${ws.name}، معك ${agentName}. كيف أقدر أساعدك؟»`,
    ),
  )

  if (profile) {
    const policy = (profile.languagePolicy ?? {}) as { switchToEnglish?: string }
    layers.push(
      layer(
        '03',
        'الصوت واللهجة',
        `${DIALECT_GUIDANCE[profile.dialect] ?? DIALECT_GUIDANCE.msa}
${STYLE_GUIDANCE[profile.style] ?? STYLE_GUIDANCE.professional}
${
  policy.switchToEnglish === 'never'
    ? 'لا تنتقل للإنجليزية مهما تحدث المتصل بها؛ أجب بالعربية.'
    : policy.switchToEnglish === 'mixed_allowed'
      ? 'يمكنك خلط مصطلح إنجليزي داخل الجملة العربية إذا كان أوضح.'
      : 'انتقل للإنجليزية فقط إذا طلب المتصل ذلك صراحةً.'
}
أسماء العلامات التجارية تُنطق كما هي، لا تُترجم.`,
      ),
    )
  }

  const hours = rules.hours ?? info.hours?.sun_thu ?? 'غير محددة'
  layers.push(
    layer(
      '04',
      'معرفة العمل',
      `ساعات العمل: ${hours}${info.hours?.sat ? ` · السبت: ${info.hours.sat}` : ''}${info.hours?.fri ? ` · الجمعة: ${info.hours.fri}` : ''}

${
  services.length
    ? `الخدمات والأسعار — أجب منها حرفيًا ولا تقدّر سعرًا غير مذكور:
${services
  .map((s) => {
    const c = (s.content ?? {}) as { price?: string; duration?: string }
    return `- ${s.title}${c.price ? ` — ${c.price}` : ''}${c.duration ? ` (${c.duration})` : ''}`
  })
  .join('\n')}`
    : 'لا توجد خدمات مسجّلة. أي سؤال عن خدمة أو سعر: حوّل للفريق.'
}

${branches.length ? `الفروع:\n${branches.map((b) => `- ${b.title}`).join('\n')}` : ''}
${staff.length ? `\nالفريق:\n${staff.map((s) => `- ${s.title}`).join('\n')}` : ''}
${policies.length ? `\nالسياسات:\n${policies.map((p) => `- ${p.title}: ${((p.content ?? {}) as { body?: string }).body ?? ''}`).join('\n')}` : ''}`,
    ),
  )

  if (flows.length) {
    layers.push(
      layer(
        '05',
        'المسارات',
        `المسارات التي تتقنها: ${flows.join('، ')}.

لمسار الحجز، اجمع بالترتيب: الخدمة، ثم اليوم والوقت المفضّل، ثم الاسم، ثم رقم الجوال.
اعرض خيارين للموعد لا أكثر. أكّد الاسم والرقم بإعادتهما على المتصل قبل التثبيت.`,
      ),
    )
  }

  layers.push(
    layer(
      '06',
      'الأدوات وسياسة التأكيد',
      `هذه أهم قاعدة لديك:

**لا تؤكد أي إجراء تجاري قبل أن ترجع الأداة بنجاح فعلي.**

- لا تقل «تم الحجز» قبل نجاح create_booking.
- لا تقل «راجعت التقويم» قبل رجوع check_availability.
- إذا فشلت الأداة أو تأخرت، قل: «تعذّر التحقق الآن، سجّلت طلبك ويتواصل معك الفريق» ثم استدع create_callback.
- لا تخبر المتصل بأسماء الأدوات ولا بتفاصيل تقنية. تحدث بلغة العمل فقط.

أثناء انتظار الأداة، قل جملة قصيرة مثل «لحظة أتحقق لك» ولا تصمت.`,
    ),
  )

  const approved = pronunciations.filter((p) => p.status === 'approved')
  if (approved.length) {
    layers.push(
      layer(
        '07',
        'النطق',
        `انطق هذه الكلمات كما هو مكتوب هنا:
${approved.map((p) => `- ${p.canonical} → ${p.spokenHint}`).join('\n')}`,
      ),
    )
  }

  const transferTo = rules.transferTo ?? routing.escalation ?? info.transferTo
  layers.push(
    layer(
      '08',
      'التصعيد والتحويل',
      `${transferTo ? `رقم التحويل: ${transferTo}` : 'لا يوجد رقم تحويل مضبوط — سجّل معاودة اتصال بدلًا من التحويل.'}

حوّل فورًا إذا:
- طلب المتصل موظفًا بشريًا.
- تكرر عدم الفهم مرتين.
- كانت الحالة شكوى أو نزاعًا.
- خرج الطلب عن الخدمات المسجّلة لديك.

${
  routing.afterHours === 'callback'
    ? 'خارج ساعات العمل: لا تحوّل. اعتذر بإيجاز، وسجّل طلب معاودة اتصال بالاسم والرقم والسبب.'
    : 'خارج ساعات العمل: اتبع سياسة التحويل نفسها.'
}`,
    ),
  )

  layers.push(layer('09', 'حدود السلامة', SAFETY))

  return layers.join('\n\n')
}
