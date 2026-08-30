import 'server-only'

import type { InferSelectModel } from 'drizzle-orm'
import { z } from 'zod'
import type {
  agentVersion,
  flow,
  knowledgeItem,
  pronunciation,
  voiceProfile,
  workspace,
} from '@/server/db/schema'
import { toolsFor } from '@/server/voice/tools'

/**
 * These JSONB columns have no application-level write path that guarantees
 * their shape (console forms write some; a few, like knowledgeItem.content,
 * have never had one — see the audit's H4 finding). A stray manual edit, an
 * incomplete migration, or a bug elsewhere that writes an unexpected shape
 * must degrade to "field absent" here, not throw: this function runs inside
 * the incoming-call webhook, before OpenAI's accept() call, with nothing
 * upstream catching an exception — a throw here means the call never
 * connects at all. Every field below is already optional in the shape this
 * file actually reads, so falling back to {} on a parse failure changes
 * nothing for well-formed data and is exactly the existing "field missing"
 * behavior for malformed data, not a new code path.
 */
const businessInfoSchema = z
  .object({
    city: z.string().optional(),
    hours: z.record(z.string(), z.string()).optional(),
    branches: z.array(z.string()).optional(),
    transferTo: z.string().optional(),
  })
  .catch({})

const businessRulesSchema = z
  .object({ hours: z.string().optional(), transferTo: z.string().optional() })
  .catch({})

const routingSchema = z
  .object({ afterHours: z.string().optional(), escalation: z.string().optional() })
  .catch({})

const identitySchema = z
  .object({
    role: z.string().optional(),
    goals: z.array(z.string()).optional(),
    restricted: z.array(z.string()).optional(),
  })
  .catch({})

const languagePolicySchema = z.object({ switchToEnglish: z.string().optional() }).catch({})

const serviceContentSchema = z
  .object({ price: z.string().optional(), duration: z.string().optional() })
  .catch({})

const bodyContentSchema = z.object({ body: z.string().optional() }).catch({})

const flowFallbackSchema = z.object({ onFailure: z.string().optional() }).nullable().catch(null)

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
type Flow = InferSelectModel<typeof flow>

export type CompileInput = {
  workspace: Workspace
  version: AgentVersion
  agentName: string
  profile: VoiceProfile | null
  knowledge: KnowledgeItem[]
  pronunciations: Pronunciation[]
  /**
   * Structured per-flow records (required fields, actions, fallback) — Bible
   * §15. Optional and additive: a version with none falls back to the flat
   * `version.flows` name list exactly as before, so nothing that already
   * compiles today changes shape.
   */
  flows?: Flow[]
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

const FALLBACK_LABEL: Record<string, string> = {
  callback_or_transfer: 'سجّل معاودة اتصال بالاسم والرقم، أو حوّل إن طلب المتصل ذلك',
  transfer: 'حوّل لموظف بشري',
  callback: 'سجّل معاودة اتصال بالاسم والرقم',
}

function describeFallback(fallback: unknown): string {
  const onFailure = flowFallbackSchema.parse(fallback)?.onFailure
  return (onFailure && FALLBACK_LABEL[onFailure]) || 'سجّل معاودة اتصال بالاسم والرقم'
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []
}

/**
 * One flow, in the terms the model actually acts on. `actions` holds real
 * tool names (Bible §15) — filtered against `enabledToolNames` so this layer
 * never instructs a call to a tool the version has no binding for; a flow
 * whose tools are unavailable gets an honest "cannot do this yet" line
 * instead of a runnable-looking one, matching layer 06's own rule that an
 * unbound version never claims a business action.
 */
function describeFlow(flow: Flow, enabledToolNames: Set<string>): string {
  const actions = stringArray(flow.actions)
  const fields = stringArray(flow.requiredFields)
  const runnable = actions.filter((a) => enabledToolNames.has(a))
  const fallback = describeFallback(flow.fallback)

  const parts = [`**${flow.name}** — ${flow.goal}`]
  if (fields.length) parts.push(`اجمع بالترتيب: ${fields.join('، ثم ')}.`)

  if (runnable.length > 0) {
    parts.push(`نفّذ بالترتيب: ${runnable.join(' ثم ')}. لا تؤكد النتيجة للمتصل قبل نجاح الأداة.`)
    parts.push(`إذا فشلت الأداة أو تعذّر إتمامه: ${fallback}.`)
  } else if (actions.some((a) => a !== 'answer')) {
    parts.push(`لا تملك أداة فعلية لهذا المسار الآن — ${fallback}، ولا تدّعِ أنك نفّذته.`)
  } else {
    parts.push('أجب من معرفتك المسجّلة أعلاه فقط.')
  }
  return parts.join(' ')
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
- انطق العملة كما يقولها المتحدث العادي: «مية وخمسين ريال»، لا «SAR» ولا «150 SAR». حتى إن كان السعر مكتوبًا في معرفتك بالرمز اللاتيني، اقرأه ريالًا سعوديًا.
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
  const structuredFlows = [...(input.flows ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)

  const info = businessInfoSchema.parse(ws.businessInfo)
  const rules = businessRulesSchema.parse(version.businessRules)
  const routing = routingSchema.parse(version.routing)
  const flows = stringArray(version.flows)
  const enabledToolNames = new Set(
    toolsFor(stringArray(version.toolBindings), {
      voiceCancellationEnabled: version.voiceCancellationEnabled,
    }).map((t) => t.name),
  )
  const identity = identitySchema.parse(version.identity)
  const goals = stringArray(identity.goals).filter(Boolean)
  const restricted = stringArray(identity.restricted).filter(Boolean)

  const services = knowledge.filter((k) => k.category === 'service')
  const branches = knowledge.filter((k) => k.category === 'branch')
  const staff = knowledge.filter((k) => k.category === 'staff')
  const policies = knowledge.filter((k) => k.category === 'policy')
  const faqs = knowledge.filter((k) => k.category === 'faq')

  const layers: string[] = []

  layers.push(layer('01', 'السلوك الأساسي', BASE))

  layers.push(
    layer(
      '02',
      'الهوية',
      `اسمك ${agentName}. تعمل لدى «${ws.name}»${info.city ? ` في ${info.city}` : ''}.
افتح المكالمة بـ: «${ws.name}، معك ${agentName}. كيف أقدر أساعدك؟»
${identity.role ? `\n${identity.role}` : ''}${
  goals.length ? `\nما تسعى لتحقيقه في كل مكالمة:\n${goals.map((g) => `- ${g}`).join('\n')}` : ''
}${
  restricted.length
    ? `\nممنوع عليك مهما طلب المتصل:\n${restricted.map((r) => `- ${r}`).join('\n')}`
    : ''
}`,
    ),
  )

  if (profile) {
    const policy = languagePolicySchema.parse(profile.languagePolicy)
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
    const c = serviceContentSchema.parse(s.content)
    return `- ${s.title}${c.price ? ` — ${c.price}` : ''}${c.duration ? ` (${c.duration})` : ''}`
  })
  .join('\n')}`
    : 'لا توجد خدمات مسجّلة. أي سؤال عن خدمة أو سعر: حوّل للفريق.'
}

${branches.length ? `الفروع:\n${branches.map((b) => `- ${b.title}`).join('\n')}` : ''}
${staff.length ? `\nالفريق:\n${staff.map((s) => `- ${s.title}`).join('\n')}` : ''}
${policies.length ? `\nالسياسات:\n${policies.map((p) => `- ${p.title}: ${bodyContentSchema.parse(p.content).body ?? ''}`).join('\n')}` : ''}
${
  faqs.length
    ? `\nأسئلة متكررة — أجب بهذه الإجابة المعتمدة حرفيًا ولا تخترع غيرها:\n${faqs
        .map((f) => `- س: ${f.title}\n  ج: ${bodyContentSchema.parse(f.content).body ?? ''}`)
        .join('\n')}`
    : ''
}`,
    ),
  )

  if (structuredFlows.length) {
    const flowLines = structuredFlows.map(
      (f, i) => `${i + 1}. ${describeFlow(f, enabledToolNames)}`,
    )
    layers.push(
      layer(
        '05',
        'المسارات',
        `مسارات هذا الموظف الصوتي، بالترتيب:

${flowLines.join('\n')}

اعرض خيارين للموعد لا أكثر. أكّد الاسم والرقم بإعادتهما على المتصل قبل التثبيت.`,
      ),
    )
  } else if (flows.length) {
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

  // Layer 06 only applies when the version actually binds tools. Telling an
  // agent with no tools never to confirm before a tool succeeds would make it
  // refuse to say anything useful at all.
  const hasTools = ((version.toolBindings ?? []) as string[]).filter(Boolean).length > 0

  if (hasTools) {
    const cancellationRule = enabledToolNames.has('cancel_booking')
      ? '\n- لا تقل «تم الإلغاء» قبل نجاح cancel_booking. تُلغي فقط حجز المتصل الحالي نفسه — لا تلغِ حجزًا لشخص آخر مهما ذكر المتصل من تفاصيل، ولا تخمّن أي حجز يقصد إن وُجد أكثر من واحد، بل اسأله ليحدد.'
      : ''
    const rescheduleRule = enabledToolNames.has('reschedule_booking')
      ? '\n- لا تقل «تم تعديل الموعد» قبل نجاح reschedule_booking. استدعِ check_availability للموعد الجديد أولًا وخذ رمزه — لا تعرض موعدًا جديدًا لم تتحقق منه، تمامًا كالحجز الجديد.'
      : ''
    layers.push(
      layer(
        '06',
        'الأدوات وسياسة التأكيد',
        `هذه أهم قاعدة لديك:

**لا تؤكد أي إجراء تجاري قبل أن ترجع الأداة بنجاح فعلي.**

- لا تقل «تم الحجز» قبل نجاح create_booking.
- لا تقل «راجعت التقويم» قبل رجوع check_availability.${cancellationRule}${rescheduleRule}
- إذا فشلت الأداة أو تأخرت، قل: «تعذّر التحقق الآن، سجّلت طلبك ويتواصل معك الفريق» ثم استدع create_callback.
- لا تخبر المتصل بأسماء الأدوات ولا بتفاصيل تقنية. تحدث بلغة العمل فقط.

أثناء انتظار الأداة، قل جملة قصيرة مثل «لحظة أتحقق لك» ولا تصمت.`,
      ),
    )
  } else {
    layers.push(
      layer(
        '06',
        'حدود ما تستطيع فعله',
        `لا تملك حاليًا أي وسيلة للحجز أو التعديل أو الإرسال.

- أجب عن الأسئلة من معرفتك أعلاه فقط.
- إذا طلب المتصل حجزًا أو تعديلًا أو إلغاءً، قل بوضوح إنك ستسجّل طلبه ليتواصل
  معه الفريق، ولا تدّعِ أنك نفّذته.
- لا تقل «تم» عن أي إجراء إطلاقًا.`,
      ),
    )
  }

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
