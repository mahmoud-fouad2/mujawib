/**
 * MUJAWIB seed — realistic operational data for the Neon database.
 *
 * Run: pnpm db:seed
 *
 * Deterministic: seeded PRNG, so repeated runs produce identical data.
 * Idempotent: truncates the operational tables it owns before inserting.
 * Batched: rows are collected in memory and flushed in chunks — neon-http is
 * one round trip per statement, so per-row inserts would take hours.
 */
import { eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DEFAULT_VOICE_PERSONAS } from '../lib/voice-personas.ts'
import * as schema from '../server/db/schema/index.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required to seed')

const client = postgres(connectionString, { max: 1, prepare: false })
const db = drizzle(client, { schema })

// ─── deterministic helpers ──────────────────────────────────────────────────

let seedState = 0x2f6e2b1
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0
  return seedState / 0x100000000
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)] as T
}
function int(min: number, max: number) {
  return min + Math.floor(rnd() * (max - min + 1))
}
function chance(p: number) {
  return rnd() < p
}

const NOW = new Date()
function daysAgo(d: number, hour = 10, minute = 0) {
  const t = new Date(NOW)
  t.setDate(t.getDate() - d)
  t.setHours(hour, minute, 0, 0)
  return t
}
function minutesAgo(m: number) {
  return new Date(NOW.getTime() - m * 60_000)
}

const idCounters = new Map<string, number>()
function id(prefix: string) {
  const n = (idCounters.get(prefix) ?? 0) + 1
  idCounters.set(prefix, n)
  return `${prefix}_${String(n).padStart(5, '0')}`
}

// ─── batched writer ─────────────────────────────────────────────────────────

const CHUNK = 400

type Batch<T extends PgTable> = {
  table: T
  label: string
  rows: T['$inferInsert'][]
  add: (row: T['$inferInsert']) => void
}

const batches: Batch<PgTable>[] = []

function batchFor<T extends PgTable>(table: T, label: string): Batch<T> {
  const rows: T['$inferInsert'][] = []
  const b: Batch<T> = {
    table,
    label,
    rows,
    add(row) {
      rows.push(row)
    },
  }
  batches.push(b as unknown as Batch<PgTable>)
  return b
}

/** Agent → live version pointers, applied after both tables are populated. */
const liveVersionLinks: { agentId: string; versionId: string }[] = []

async function flushAll() {
  for (const b of batches) {
    if (b.rows.length === 0) continue
    for (let i = 0; i < b.rows.length; i += CHUNK) {
      await db.insert(b.table).values(b.rows.slice(i, i + CHUNK))
    }
    console.log(`  · ${b.label}: ${b.rows.length}`)
  }
}

// Insert order matters (foreign keys) — declared parent → child.
const B = {
  organization: batchFor(schema.organization, 'organization'),
  workspace: batchFor(schema.workspace, 'workspace'),
  industryTemplate: batchFor(schema.industryTemplate, 'industry_template'),
  voiceProfile: batchFor(schema.voiceProfile, 'voice_profile'),
  knowledgeItem: batchFor(schema.knowledgeItem, 'knowledge_item'),
  customer: batchFor(schema.customer, 'customer'),
  agent: batchFor(schema.agent, 'agent'),
  agentVersion: batchFor(schema.agentVersion, 'agent_version'),
  flow: batchFor(schema.flow, 'flow'),
  phoneNumber: batchFor(schema.phoneNumber, 'phone_number'),
  integrationConnection: batchFor(schema.integrationConnection, 'integration_connection'),
  call: batchFor(schema.call, 'call'),
  callEvent: batchFor(schema.callEvent, 'call_event'),
  toolExecution: batchFor(schema.toolExecution, 'tool_execution'),
  booking: batchFor(schema.booking, 'booking'),
  lead: batchFor(schema.lead, 'lead'),
  qaResult: batchFor(schema.qaResult, 'qa_result'),
  pronunciation: batchFor(schema.pronunciation, 'pronunciation'),
  changeRequest: batchFor(schema.changeRequest, 'change_request'),
  scenarioTest: batchFor(schema.scenarioTest, 'scenario_test'),
  scenarioRun: batchFor(schema.scenarioRun, 'scenario_run'),
  auditLog: batchFor(schema.auditLog, 'audit_log'),
}

// ─── reference data ─────────────────────────────────────────────────────────

const ORG_ID = 'org_mujawib'

type ClientSpec = {
  id: string
  name: string
  slug: string
  pack: 'medical' | 'realestate' | 'auto' | 'reception'
  status: 'live' | 'pilot' | 'setup' | 'discovery'
  city: string
  agentName: string
  did: string
  transferTo: string
  services: { title: string; price: string; duration: string }[]
  branches: string[]
  staff: string[]
  intents: string[]
}

const CLIENTS: ClientSpec[] = [
  {
    id: 'ws_alfa_clinic',
    name: 'عيادات ألفا الطبية',
    slug: 'alfa-clinic',
    pack: 'medical',
    status: 'live',
    city: 'الرياض',
    agentName: 'سارة',
    did: '+966112400118',
    transferTo: '+966551200430',
    services: [
      { title: 'كشف أسنان عام', price: '250 ر.س', duration: '30 دقيقة' },
      { title: 'تنظيف وتلميع', price: '400 ر.س', duration: '45 دقيقة' },
      { title: 'استشارة جلدية', price: '300 ر.س', duration: '20 دقيقة' },
      { title: 'متابعة بعد عملية', price: 'بدون رسوم', duration: '15 دقيقة' },
    ],
    branches: ['فرع العليا', 'فرع الملقا', 'فرع الروضة'],
    staff: ['د. سليمان الحبيب', 'د. مها العتيبي', 'د. فيصل الدوسري'],
    intents: ['حجز موعد', 'تغيير موعد', 'استفسار عن سعر', 'استفسار عن طبيب', 'إلغاء موعد'],
  },
  {
    id: 'ws_dune_realty',
    name: 'ديون العقارية',
    slug: 'dune-realty',
    pack: 'realestate',
    status: 'live',
    city: 'جدة',
    agentName: 'ريم',
    did: '+966126700245',
    transferTo: '+966553380190',
    services: [
      { title: 'مشروع دُرة الشاطئ', price: 'من 1.2 مليون ر.س', duration: 'استلام فوري' },
      { title: 'أبراج الكورنيش', price: 'من 890 ألف ر.س', duration: 'تسليم 2027' },
      { title: 'فلل الياسمين', price: 'من 2.4 مليون ر.س', duration: 'استلام فوري' },
    ],
    branches: ['المكتب الرئيسي — جدة', 'معرض المبيعات — أبحر'],
    staff: ['أحمد الزهراني', 'نورة القحطاني'],
    intents: ['استفسار عن مشروع', 'حجز معاينة', 'طلب عرض سعر', 'تحويل لمستشار مبيعات'],
  },
  {
    id: 'ws_nova_auto',
    name: 'نوفا لخدمات السيارات',
    slug: 'nova-auto',
    pack: 'auto',
    status: 'live',
    city: 'الدمام',
    agentName: 'خالد',
    did: '+966138900472',
    transferTo: '+966558820117',
    services: [
      { title: 'صيانة دورية 10 آلاف كم', price: '650 ر.س', duration: 'ساعتان' },
      { title: 'فحص شامل قبل الشراء', price: '450 ر.س', duration: '90 دقيقة' },
      { title: 'تغيير إطارات وموازنة', price: 'حسب المقاس', duration: '45 دقيقة' },
    ],
    branches: ['مركز الخدمة — الدمام', 'مركز الخدمة — الخبر'],
    staff: ['سعد المطيري — مشرف الورشة'],
    intents: ['حجز صيانة', 'متابعة حالة السيارة', 'استفسار عن سعر', 'شكوى'],
  },
  {
    id: 'ws_mazarena',
    name: 'مزارِنا للتجزئة',
    slug: 'mazarena',
    pack: 'reception',
    status: 'pilot',
    city: 'الرياض',
    agentName: 'ليان',
    did: '+966114550388',
    transferTo: '+966556610902',
    services: [{ title: 'خدمة العملاء العامة', price: '—', duration: '—' }],
    branches: ['المقر الرئيسي'],
    staff: ['فريق خدمة العملاء'],
    intents: ['استفسار عن طلب', 'شكوى', 'تحويل لقسم', 'ترك رسالة'],
  },
  {
    id: 'ws_wallan',
    name: 'ولّان للتجارة',
    slug: 'wallan',
    pack: 'reception',
    status: 'setup',
    city: 'الرياض',
    agentName: 'عمر',
    did: '+966115500741',
    transferTo: '+966557740266',
    services: [{ title: 'استقبال عام', price: '—', duration: '—' }],
    branches: ['المقر الرئيسي'],
    staff: ['الاستقبال'],
    intents: ['تحويل لقسم', 'استفسار عام'],
  },
]

const PACKS = [
  {
    key: 'medical',
    name: 'استقبال العيادات',
    version: 'v4',
    flows: ['حجز موعد', 'تغيير موعد', 'إلغاء', 'استفسارات', 'تحويل'],
    integrations: ['google_calendar', 'whatsapp', 'rest_api'],
  },
  {
    key: 'realestate',
    name: 'العقارات',
    version: 'v3',
    flows: ['تأهيل عميل', 'حجز معاينة', 'تحويل مبيعات'],
    integrations: ['hubspot', 'google_calendar', 'whatsapp'],
  },
  {
    key: 'auto',
    name: 'خدمات السيارات',
    version: 'v3',
    flows: ['حجز صيانة', 'حالة الطلب', 'استفسار'],
    integrations: ['google_calendar', 'whatsapp', 'rest_api'],
  },
  {
    key: 'reception',
    name: 'الاستقبال العام',
    version: 'v2',
    flows: ['توجيه', 'رسالة', 'معاودة اتصال', 'عميل محتمل'],
    integrations: ['rest_api', 'whatsapp'],
  },
  {
    key: 'hospitality',
    name: 'الضيافة والمطاعم',
    version: 'v1',
    flows: ['حجز أو استعلام', 'تعديل طلب قائم', 'استفسار عن خدمة', 'تحويل للقسم المختص'],
    integrations: ['google_calendar', 'whatsapp', 'rest_api'],
  },
  {
    key: 'services',
    name: 'خدمة العملاء العامة',
    version: 'v1',
    flows: ['استفسار عن خدمة أو منتج', 'تسجيل طلب متابعة', 'حجز موعد أو زيارة', 'تحويل لموظف'],
    integrations: ['whatsapp', 'rest_api'],
  },
]

const VOICE_PROFILES = DEFAULT_VOICE_PERSONAS

const INTEGRATION_CATALOG: Record<string, string> = {
  google_calendar: 'Google Calendar',
  microsoft_365: 'Microsoft 365',
  whatsapp: 'WhatsApp Business',
  hubspot: 'HubSpot',
  zoho_crm: 'Zoho CRM',
  odoo: 'Odoo',
  rest_api: 'REST API للعميل',
}

const CALLER_PREFIXES = ['+96650', '+96653', '+96655', '+96656', '+96659']

const ARABIC_NAMES = [
  'عبدالله الشمري',
  'منى الغامدي',
  'طارق بن سالم',
  'هند العنزي',
  'ياسر المالكي',
  'ريما الحربي',
  'سلطان الرشيد',
  'دانة الفهد',
  'أسماء بركات',
  'فهد التميمي',
  'لطيفة الجابر',
  'بدر القرني',
]

const QA_FLAGS = [
  'تكرار الاستيضاح',
  'مشكلة نطق',
  'فجوة معرفية',
  'فشل أداة',
  'صمت طويل',
  'تبديل لغة غير متوقع',
  'تحويل غير متوقع',
  'إنجاز مهمة منخفض',
]

// ─── transcript generation ──────────────────────────────────────────────────

type Turn = { role: 'agent' | 'caller'; text: string; at: number }

function buildTranscript(client: ClientSpec, intent: string, outcome: string): Turn[] {
  const service = pick(client.services)
  const branch = pick(client.branches)
  const turns: Turn[] = []
  let t = 0
  const push = (role: 'agent' | 'caller', text: string, gap = int(2, 6)) => {
    t += gap
    turns.push({ role, text, at: t })
  }

  push('agent', `${client.name}، معك ${client.agentName}. كيف أقدر أساعدك؟`, 1)

  if (intent.includes('حجز')) {
    push('caller', `أبغى أحجز ${service.title}`)
    push('agent', 'أبشر. تفضّل أي يوم يناسبك؟')
    push('caller', 'بكرة، ويفضّل بعد العصر')
    push('agent', `عندي 5:30 أو 6:15 في ${branch}. أيهما أنسب؟`)
    push('caller', 'خمسة ونص')
    push('agent', 'ممتاز. ممكن اسمك ورقم الجوال للتأكيد؟')
    push('caller', pick(ARABIC_NAMES))
    if (outcome === 'booking') {
      push('agent', `تم الحجز — ${service.title} بكرة 5:30 مساءً في ${branch}. وصلتك رسالة التأكيد.`)
      push('caller', 'شكرًا لك')
    } else if (outcome === 'callback') {
      push('agent', 'تعذر التحقق من المواعيد الآن. سجّلت طلبك ويتواصل معك الفريق خلال ساعة.')
      push('caller', 'تمام')
    } else {
      push('agent', 'أحوّلك للفريق لإكمال الحجز، لحظة من فضلك.')
    }
  } else if (intent.includes('سعر') || intent.includes('عرض')) {
    push('caller', `كم سعر ${service.title}؟`)
    if (outcome === 'resolved' || outcome === 'lead') {
      push('agent', `${service.title} بـ ${service.price}، ومدته ${service.duration}. تحب أحجز لك؟`)
      push('caller', 'لا، بس أستفسر. شكرًا')
      push('agent', 'على الرحب والسعة، نسعد بخدمتك.')
    } else {
      push('agent', 'السعر يعتمد على الحالة، أفضّل أحوّلك للفريق ليعطيك رقمًا دقيقًا.')
      push('caller', 'طيب حوّلني')
    }
  } else if (intent.includes('تغيير') || intent.includes('إلغاء')) {
    push('caller', 'عندي موعد وأبغى أأجله')
    push('agent', 'أكيد. ممكن رقم الجوال المسجّل بالحجز؟')
    push('caller', `${pick(CALLER_PREFIXES)}${int(1000000, 9999999)}`)
    if (outcome === 'resolved' || outcome === 'booking') {
      push('agent', 'لقيت الحجز. متاح الأحد الجاي 4:00 أو الاثنين 6:30.')
      push('caller', 'الأحد يناسبني')
      push('agent', 'تم التعديل للأحد 4:00 عصرًا، ووصلتك رسالة بالتفاصيل.')
    } else {
      push('agent', 'ما قدرت أوصل لنظام المواعيد الآن. حوّلتك للفريق لإتمام التعديل.')
    }
  } else if (intent.includes('شكوى')) {
    push('caller', 'عندي مشكلة في الخدمة اللي استلمتها')
    push('agent', 'أعتذر عن ذلك. ممكن توضح لي التفاصيل حتى أوصلها بشكل صحيح؟')
    push('caller', 'الموعد تأخر أكثر من ساعة')
    push('agent', 'سجّلت الشكوى بالتفاصيل وأحوّلك الآن لمسؤول الخدمة.')
  } else if (intent.includes('معاينة') || intent.includes('مشروع')) {
    push('caller', `أبغى أعرف تفاصيل ${service.title}`)
    push('agent', `${service.title} — ${service.price}، ${service.duration}. تحب تحجز معاينة؟`)
    push('caller', 'إي، نهاية الأسبوع')
    push('agent', 'ممكن اسمك ورقمك حتى يرتب المستشار الموعد؟')
    push('caller', pick(ARABIC_NAMES))
    push('agent', 'تم تسجيل طلبك، يتواصل معك مستشار المبيعات لتأكيد الموعد.')
  } else if (intent.includes('متابعة')) {
    push('caller', 'أبغى أعرف حالة سيارتي')
    push('agent', 'ممكن رقم اللوحة أو رقم أمر التشغيل؟')
    push('caller', `أمر ${int(10000, 99999)}`)
    push('agent', 'الصيانة في المرحلة الأخيرة، والاستلام متاح بكرة بعد الساعة 2 ظهرًا.')
  } else {
    push('caller', intent)
    push('agent', 'استلمت طلبك. أوجّهك للقسم المختص الآن.')
  }

  return turns
}

// ─── seeding ────────────────────────────────────────────────────────────────

const OWNED_TABLES = [
  'scenario_run',
  'scenario_test',
  'qa_result',
  'tool_execution',
  'call_event',
  'booking',
  'lead',
  'call',
  'phone_number',
  'flow',
  'agent_version',
  'agent',
  'knowledge_item',
  'customer',
  'pronunciation',
  'voice_profile',
  'integration_connection',
  'tool',
  'change_request',
  'audit_log',
  'industry_template',
  'workspace',
]

async function clear() {
  for (const t of OWNED_TABLES) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${t}" CASCADE`))
  }
  await db.execute(sql`DELETE FROM "organization" WHERE id = ${ORG_ID}`)
  console.log('· cleared operational tables')
}

function build() {
  B.organization.add({
    id: ORG_ID,
    name: 'MUJAWIB Operations',
    slug: 'mujawib',
    createdAt: daysAgo(240),
  })

  const templateIdByKey = new Map<string, string>()
  for (const p of PACKS) {
    const tid = id('tpl')
    templateIdByKey.set(p.key, tid)
    B.industryTemplate.add({
      id: tid,
      packKey: p.key,
      name: p.name,
      version: p.version,
      knowledgeSchema: {
        entities: ['services', 'branches', 'staff', 'policies', 'faqs'],
        fields: {
          service: [
            'body',
            'price',
            'duration',
            'suitableFor',
            'requirements',
            'preparation',
            'aftercare',
            'outcome',
            'availability',
            'owner',
            'branch',
          ],
          staff: ['body', 'specialty', 'role', 'qualifications', 'experience', 'services'],
          branch: ['address', 'phone', 'hours', 'body'],
          policy: ['body', 'scope', 'exceptions', 'escalation'],
          faq: ['answer', 'relatedService'],
        },
      },
      defaultFlows: p.flows,
      defaultIntegrations: p.integrations,
      qaSuite: p.flows.map((f) => `سيناريو ${f}`),
      createdAt: daysAgo(200),
    })
  }

  const voiceProfileIds: string[] = []
  for (const v of VOICE_PROFILES) {
    const vid = id('voice')
    voiceProfileIds.push(vid)
    B.voiceProfile.add({
      id: vid,
      workspaceId: null,
      name: v.label,
      country: v.country,
      dialect: v.dialect,
      style: v.style,
      languagePolicy: v.policy,
      pacing: v.pacing,
      isGlobal: true,
      createdAt: daysAgo(190),
    })
  }

  B.workspace.add({
    id: 'ws_operator',
    organizationId: ORG_ID,
    name: 'MUJAWIB Operations',
    slug: 'operations',
    type: 'operator',
    status: 'live',
    createdAt: daysAgo(240),
  })

  let totalCalls = 0

  for (const client of CLIENTS) {
    const packIndex = PACKS.findIndex((p) => p.key === client.pack)
    const pack = PACKS[packIndex]!
    const isLive = client.status === 'live'
    const activeDays = isLive ? 45 : client.status === 'pilot' ? 18 : 0

    B.workspace.add({
      id: client.id,
      organizationId: ORG_ID,
      name: client.name,
      slug: client.slug,
      type: 'client',
      status: client.status,
      industryPack: client.pack,
      timezone: 'Asia/Riyadh',
      locale: 'ar-SA',
      businessInfo: {
        city: client.city,
        hours: { sun_thu: '09:00–21:00', fri: 'مغلق', sat: '10:00–18:00' },
        branches: client.branches,
        staff: client.staff,
        transferTo: client.transferTo,
      },
      retentionPolicy: { calls: '180d', recordings: '30d', transcripts: '180d' },
      createdAt: daysAgo(activeDays + 30),
    })

    for (const s of client.services) {
      const owner = pick(client.staff)
      B.knowledgeItem.add({
        id: id('kn'),
        workspaceId: client.id,
        category: 'service',
        title: s.title,
        content: {
          body: `${s.title} ضمن خدمات ${client.name}. يشرح الموظف الهدف منها باختصار، ثم يوجه المتصل للحجز أو المتابعة حسب حاجته.`,
          price: s.price,
          duration: s.duration,
          suitableFor: 'العملاء الذين يطلبون هذه الخدمة أو يحتاجون توضيحًا قبل الحجز.',
          requirements: 'الاسم وتأكيد آخر أربعة أرقام من رقم الاتصال، وأي ملاحظة تخص الطلب.',
          outcome: 'توضيح الخدمة ثم حجز موعد أو تسجيل متابعة عند الحاجة.',
          availability: 'حسب المواعيد المتاحة وساعات العمل المسجلة.',
          owner,
          branch: pick(client.branches),
        },
        source: 'structured',
        createdAt: daysAgo(activeDays + 20),
      })
    }
    for (const b of client.branches) {
      B.knowledgeItem.add({
        id: id('kn'),
        workspaceId: client.id,
        category: 'branch',
        title: b,
        content: { city: client.city, hours: '09:00–21:00' },
        source: 'structured',
        createdAt: daysAgo(activeDays + 20),
      })
    }
    for (const s of client.staff) {
      B.knowledgeItem.add({
        id: id('kn'),
        workspaceId: client.id,
        category: 'staff',
        title: s,
        content: {
          role:
            client.pack === 'medical'
              ? 'مختص يستقبل الحالات حسب جدول العيادة'
              : 'مسؤول خدمة أو متابعة',
          specialty: client.pack === 'medical' ? 'خدمات المركز المسجلة' : client.pack,
          experience: 'يُشرح دوره من المعرفة المعتمدة فقط دون وعود أو تفاصيل غير مسجلة.',
          services: client.services.map((service) => service.title).join('، '),
          branch: pick(client.branches),
          body: 'متاح حسب ساعات العمل وجداول الفريق.',
        },
        source: 'structured',
        createdAt: daysAgo(activeDays + 20),
      })
    }
    B.knowledgeItem.add({
      id: id('kn'),
      workspaceId: client.id,
      category: 'policy',
      title: 'سياسة الإلغاء',
      content: { body: 'الإلغاء المجاني قبل 12 ساعة من الموعد.' },
      source: 'structured',
      createdAt: daysAgo(activeDays + 20),
    })

    const agentId = id('agent')
    const liveVersionNo = isLive ? int(14, 19) : client.status === 'pilot' ? 6 : 2
    const liveVersionId = id('av')
    const voiceProfileId = voiceProfileIds[packIndex % voiceProfileIds.length]!
    const published = isLive || client.status === 'pilot'

    B.agent.add({
      id: agentId,
      workspaceId: client.id,
      name: client.agentName,
      templateId: templateIdByKey.get(client.pack),
      // Set after the versions land — the two tables reference each other, so
      // neither can be inserted complete before the other exists.
      liveVersionId: null,
      createdAt: daysAgo(activeDays + 25),
    })
    if (published) liveVersionLinks.push({ agentId, versionId: liveVersionId })

    B.agentVersion.add({
      id: liveVersionId,
      agentId,
      versionNumber: liveVersionNo,
      status: published ? 'published' : 'draft',
      identity: {
        role: `موظف استقبال صوتي لدى ${client.name}`,
        goals: ['حجز المواعيد', 'الإجابة على الاستفسارات', 'التحويل الآمن عند الحاجة'],
        restricted: ['لا يعطي استشارة متخصصة', 'لا يؤكد سعرًا غير موجود في المعرفة'],
      },
      voiceProfileId,
      businessRules: { hours: '09:00–21:00', transferTo: client.transferTo },
      flows: pack.flows,
      toolBindings: pack.integrations,
      routing: { afterHours: 'callback', escalation: client.transferTo },
      readinessScore: isLive ? int(92, 99) : int(70, 88),
      blockers: isLive ? [] : ['اختبار الهاتف لم يكتمل'],
      publishedAt: published ? daysAgo(int(3, 20)) : null,
      publishedById: null,
      createdAt: daysAgo(activeDays + 10),
    })

    if (isLive) {
      B.agentVersion.add({
        id: id('av'),
        agentId,
        versionNumber: liveVersionNo + 1,
        status: 'draft',
        identity: { role: `موظف استقبال صوتي لدى ${client.name}` },
        voiceProfileId,
        businessRules: { hours: '09:00–21:00', transferTo: client.transferTo },
        flows: pack.flows,
        toolBindings: pack.integrations,
        routing: { afterHours: 'callback', escalation: client.transferTo },
        readinessScore: int(74, 90),
        blockers: ['3 سيناريوهات حرجة لم تُختبر بعد'],
        createdAt: daysAgo(int(1, 5)),
      })
    }

    for (const [i, f] of pack.flows.entries()) {
      B.flow.add({
        id: id('flow'),
        agentVersionId: liveVersionId,
        name: f,
        goal: `إنجاز ${f} بدون تدخل بشري`,
        requiredFields: f.includes('حجز')
          ? ['الخدمة', 'التاريخ والوقت', 'الاسم', 'تأكيد آخر أربعة أرقام من رقم الاتصال']
          : ['الموضوع'],
        actions: f.includes('حجز') ? ['check_availability', 'create_booking'] : ['answer'],
        fallback: { onFailure: 'callback_or_transfer' },
        sortOrder: i,
        createdAt: daysAgo(activeDays + 8),
      })
    }

    const phoneId = id('phone')
    B.phoneNumber.add({
      id: phoneId,
      workspaceId: client.id,
      e164: client.did,
      label: `الرقم الرئيسي — ${client.city}`,
      agentId,
      mode: 'all_calls',
      transferDestination: client.transferTo,
      sipStatus: published ? 'verified' : 'pending',
      routingRules: { afterHours: 'callback', overflowAfterSeconds: 20 },
      lastTestAt: published ? minutesAgo(int(5, 600)) : null,
      createdAt: daysAgo(activeDays + 12),
    })

    for (const provider of pack.integrations) {
      const degraded = isLive && chance(0.18)
      const failed = client.status === 'pilot' && provider === 'whatsapp'
      B.integrationConnection.add({
        id: id('int'),
        workspaceId: client.id,
        provider,
        label: INTEGRATION_CATALOG[provider] ?? provider,
        health: failed
          ? 'failed'
          : degraded
            ? 'degraded'
            : published
              ? 'connected'
              : 'disconnected',
        credentialsRef: `secret://${client.slug}/${provider}`,
        config: { scope: 'workspace' },
        lastSuccessAt: published ? minutesAgo(int(2, 240)) : null,
        lastErrorAt: failed || degraded ? minutesAgo(int(5, 90)) : null,
        errorRate24h: failed ? '31%' : degraded ? '7%' : '0%',
        createdAt: daysAgo(activeDays + 10),
      })
    }

    if (activeDays === 0) {
      console.log(`· built ${client.name} (setup — no call history)`)
      continue
    }

    const customers: { id: string; phone: string; name: string }[] = []
    for (let i = 0; i < int(16, 28); i++) {
      const phone = `${pick(CALLER_PREFIXES)}${int(1000000, 9999999)}`
      if (customers.some((c) => c.phone === phone)) continue
      const cid = id('cust')
      const name = pick(ARABIC_NAMES)
      customers.push({ id: cid, phone, name })
      B.customer.add({
        id: cid,
        workspaceId: client.id,
        phone,
        name,
        tags: chance(0.3) ? ['متكرر'] : [],
        lastCallAt: minutesAgo(int(30, 20000)),
        createdAt: daysAgo(int(5, activeDays)),
      })
    }

    const callsPerDay = isLive ? int(18, 30) : int(5, 11)

    for (let d = activeDays; d >= 0; d--) {
      const dayVolume =
        d === 0 ? Math.max(4, Math.floor(callsPerDay * 0.6)) : callsPerDay + int(-5, 6)

      for (let c = 0; c < dayVolume; c++) {
        const cust = pick(customers)
        const intent = pick(client.intents)
        // Today's calls stop at the current hour — a call cannot start in the future.
        const latestHour = d === 0 ? Math.min(20, Math.max(9, NOW.getHours())) : 20
        const hour = int(9, latestHour)
        const minute = hour === NOW.getHours() && d === 0 ? int(0, NOW.getMinutes()) : int(0, 59)
        const startedAt = daysAgo(d, hour, minute)

        const roll = rnd()
        let status: (typeof schema.callStatusEnum.enumValues)[number] = 'completed'
        let outcome: (typeof schema.callOutcomeEnum.enumValues)[number] | null = 'resolved'

        if (intent.includes('حجز') || intent.includes('معاينة')) {
          if (roll < 0.68) outcome = 'booking'
          else if (roll < 0.78) outcome = 'callback'
          else if (roll < 0.9) {
            outcome = 'transfer'
            status = 'transferred'
          } else outcome = 'unresolved'
        } else if (intent.includes('شكوى')) {
          outcome = roll < 0.7 ? 'transfer' : 'resolved'
          if (outcome === 'transfer') status = 'transferred'
        } else if (client.pack === 'realestate' && roll < 0.4) {
          outcome = 'lead'
        } else if (roll < 0.82) outcome = 'resolved'
        else if (roll < 0.92) {
          outcome = 'transfer'
          status = 'transferred'
        } else outcome = 'unresolved'

        if (chance(0.02)) {
          status = 'failed'
          outcome = 'failed'
        }
        if (chance(0.015)) {
          status = 'abandoned'
          outcome = null
        }

        const turns = buildTranscript(client, intent, outcome ?? 'unresolved')
        const durationSeconds =
          status === 'abandoned' ? int(4, 18) : turns[turns.length - 1]!.at + int(4, 20)

        // A call that would still be running now is left out rather than dated forward.
        if (startedAt.getTime() + durationSeconds * 1000 > NOW.getTime()) continue

        const callId = id('call')
        B.call.add({
          id: callId,
          workspaceId: client.id,
          agentVersionId: liveVersionId,
          phoneNumberId: phoneId,
          externalCallId: `rtc_${callId}`,
          callerNumber: cust.phone,
          status,
          outcome,
          intent,
          durationSeconds,
          transcript: turns,
          metadata: {
            customerId: cust.id,
            customerName: cust.name,
            branch: pick(client.branches),
            afterHours: hour >= 19,
          },
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
          createdAt: startedAt,
        })
        totalCalls++

        const events: { type: string; payload: Record<string, unknown>; offset: number }[] = [
          { type: 'ring', payload: { to: client.did }, offset: 0 },
          { type: 'answered', payload: { agent: client.agentName }, offset: 1 },
        ]
        for (const turn of turns) {
          events.push({
            type: turn.role === 'agent' ? 'agent_turn' : 'caller_turn',
            payload: { text: turn.text },
            offset: turn.at,
          })
        }
        if (status === 'transferred') {
          events.push({
            type: 'transfer',
            payload: { to: client.transferTo, reason: intent },
            offset: Math.max(2, durationSeconds - 2),
          })
        }
        events.push({
          type: status === 'abandoned' ? 'abandoned' : 'ended',
          payload: { outcome },
          offset: durationSeconds,
        })

        for (const ev of events) {
          B.callEvent.add({
            id: id('ev'),
            callId,
            type: ev.type,
            payload: ev.payload,
            latencyMs: ev.type === 'agent_turn' ? int(280, 900) : null,
            occurredAt: new Date(startedAt.getTime() + ev.offset * 1000),
          })
        }

        if (outcome === 'booking' || outcome === 'callback' || intent.includes('تغيير')) {
          const checkOk = outcome !== 'callback'
          B.toolExecution.add({
            id: id('tex'),
            callId,
            toolName: 'check_availability',
            request: { date: 'tomorrow', service: pick(client.services).title },
            result: checkOk ? { slots: ['17:30', '18:15'] } : { error: 'upstream_timeout' },
            status: checkOk ? 'succeeded' : 'failed',
            latencyMs: checkOk ? int(320, 1400) : int(1800, 4200),
            executedAt: new Date(startedAt.getTime() + Math.max(2, durationSeconds - 12) * 1000),
          })
          if (outcome === 'booking') {
            B.toolExecution.add({
              id: id('tex'),
              callId,
              toolName: 'create_booking',
              request: { slot: '17:30', name: cust.name, phone: cust.phone },
              result: { bookingId: `bk_${callId}` },
              status: 'succeeded',
              latencyMs: int(400, 1200),
              executedAt: new Date(startedAt.getTime() + Math.max(3, durationSeconds - 6) * 1000),
            })
            B.toolExecution.add({
              id: id('tex'),
              callId,
              toolName: 'send_confirmation',
              request: { channel: 'whatsapp', to: cust.phone },
              result: { messageId: `wam_${callId}` },
              status: 'succeeded',
              latencyMs: int(180, 600),
              executedAt: new Date(startedAt.getTime() + Math.max(4, durationSeconds - 3) * 1000),
            })
          }
        }

        if (outcome === 'booking') {
          const svc = pick(client.services)
          B.booking.add({
            id: id('bk'),
            workspaceId: client.id,
            callId,
            externalId: `gcal_${callId}`,
            customerName: cust.name,
            customerPhone: cust.phone,
            service: svc.title,
            scheduledAt: daysAgo(d - int(1, 9), int(9, 19), pick([0, 15, 30, 45])),
            status: chance(0.06) ? 'cancelled' : 'confirmed',
            metadata: { branch: pick(client.branches), price: svc.price },
            createdAt: startedAt,
          })
        }
        if (outcome === 'lead') {
          B.lead.add({
            id: id('lead'),
            workspaceId: client.id,
            callId,
            name: cust.name,
            phone: cust.phone,
            interest: pick(client.services).title,
            status: pick(['new', 'contacted', 'qualified']),
            metadata: { source: 'voice' },
            createdAt: startedAt,
          })
        }

        const needsReview =
          outcome === 'unresolved' ||
          status === 'failed' ||
          (outcome === 'transfer' && chance(0.35)) ||
          chance(0.04)
        if (needsReview) {
          const flags = new Set([pick(QA_FLAGS)])
          if (chance(0.3)) flags.add(pick(QA_FLAGS))
          B.qaResult.add({
            id: id('qa'),
            callId,
            reviewerId: null,
            score: int(48, 88),
            flags: [...flags],
            notes: 'بحاجة إلى مراجعة بشرية — راجع سبب عدم الإنجاز.',
            action: chance(0.4) ? 'pronunciation_fix' : null,
            createdAt: new Date(startedAt.getTime() + 60_000),
          })
        }
      }
    }

    if (isLive) {
      for (let i = 0; i < int(1, 3); i++) {
        const cust = pick(customers)
        const intent = pick(client.intents)
        const startedAt = minutesAgo(int(1, 6))
        const callId = id('call')
        B.call.add({
          id: callId,
          workspaceId: client.id,
          agentVersionId: liveVersionId,
          phoneNumberId: phoneId,
          externalCallId: `rtc_${callId}`,
          callerNumber: cust.phone,
          status: chance(0.25) ? 'waiting_tool' : 'live',
          outcome: null,
          intent,
          durationSeconds: null,
          transcript: buildTranscript(client, intent, 'resolved').slice(0, int(2, 5)),
          metadata: { customerId: cust.id, customerName: cust.name, branch: pick(client.branches) },
          startedAt,
          endedAt: null,
          createdAt: startedAt,
        })
        totalCalls++
        B.callEvent.add({
          id: id('ev'),
          callId,
          type: 'answered',
          payload: { agent: client.agentName },
          occurredAt: startedAt,
        })
      }
    }

    const words = [
      { c: 'Rejuvera', a: 'ريجوفيرا', h: 'ري-جو-في-را', cat: 'brand' },
      { c: client.city, a: client.city, h: client.city, cat: 'area' },
      {
        c: client.staff[0] ?? 'الفريق',
        a: client.staff[0] ?? 'الفريق',
        h: client.staff[0] ?? 'الفريق',
        cat: 'person',
      },
    ]
    for (const w of words) {
      B.pronunciation.add({
        id: id('pron'),
        workspaceId: client.id,
        canonical: w.c,
        arabicDisplay: w.a,
        spokenHint: w.h,
        category: w.cat,
        scope: 'client',
        status: chance(0.7) ? 'approved' : 'draft',
        createdAt: daysAgo(int(2, activeDays)),
      })
    }

    const requests = [
      { type: 'business_info', title: 'تحديث ساعات العمل في رمضان' },
      { type: 'new_service', title: `إضافة خدمة ${pick(client.services).title}` },
      { type: 'behavior', title: 'تقصير التحية الافتتاحية' },
      { type: 'pronunciation', title: 'تصحيح نطق اسم الفرع' },
    ]
    for (const r of requests.slice(0, int(2, 4))) {
      B.changeRequest.add({
        id: id('cr'),
        workspaceId: client.id,
        type: r.type,
        title: r.title,
        description: 'طلب من العميل عبر بوابة التغييرات.',
        status: pick(['requested', 'in_review', 'testing', 'scheduled', 'live']),
        requestedById: 'client_admin',
        assignedToId: 'ops',
        createdAt: daysAgo(int(1, 25)),
      })
    }

    const scenarios = [
      { name: 'تحية قصيرة طبيعية', cat: 'voice', critical: true },
      { name: 'اسم عربي مركب', cat: 'voice', critical: true },
      { name: 'رقم هاتف 10 أرقام', cat: 'entity', critical: true },
      { name: 'سعر بالريال', cat: 'entity', critical: true },
      { name: 'وقت 6:30 مساءً', cat: 'entity', critical: true },
      { name: 'جملة عربية-إنجليزية', cat: 'language', critical: false },
      { name: 'تصحيح رقم بعد خطأ', cat: 'recovery', critical: true },
      { name: 'لم أسمع الجزء الأخير', cat: 'recovery', critical: false },
      { name: 'طلب تحويل لموظف', cat: 'routing', critical: true },
      { name: 'فشل أداة الحجز', cat: 'tool', critical: true },
    ]
    for (const s of scenarios) {
      const sid = id('scn')
      B.scenarioTest.add({
        id: sid,
        agentVersionId: liveVersionId,
        name: s.name,
        category: s.cat,
        input: { utterance: s.name },
        expectedOutcome: { pass: true },
        isCritical: s.critical,
        createdAt: daysAgo(activeDays + 5),
      })
      const passed = isLive ? chance(0.93) : chance(0.72)
      B.scenarioRun.add({
        id: id('run'),
        agentVersionId: liveVersionId,
        scenarioId: sid,
        passed,
        score: passed ? int(88, 100) : int(40, 72),
        details: { notes: passed ? 'مطابق للمتوقع' : 'يحتاج مراجعة' },
        ranAt: daysAgo(int(1, 6)),
      })
    }

    const auditActions: [string, string, string][] = [
      ['agent.publish', 'agent_version', `نشر النسخة v${liveVersionNo}`],
      ['integration.connect', 'integration', 'ربط Google Calendar'],
      ['phone.route_change', 'phone_number', 'تحديث وجهة التحويل'],
      ['qa.review', 'call', 'إغلاق مراجعة جودة'],
    ]
    for (const [action, resourceType, note] of auditActions) {
      B.auditLog.add({
        id: id('audit'),
        workspaceId: client.id,
        actorId: 'ops',
        action,
        resourceType,
        resourceId: agentId,
        metadata: { note },
        createdAt: daysAgo(int(1, 20)),
      })
    }

    console.log(`· built ${client.name} — ${client.status}`)
  }

  return totalCalls
}

async function main() {
  await clear()
  const totalCalls = build()
  console.log('· inserting…')
  await flushAll()
  for (const link of liveVersionLinks) {
    await db
      .update(schema.agent)
      .set({ liveVersionId: link.versionId })
      .where(eq(schema.agent.id, link.agentId))
  }
  console.log(`\n✓ seed complete — ${totalCalls} calls across ${CLIENTS.length} client workspaces`)
}

main()
  .then(async () => {
    await client.end()
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    return client.end().finally(() => process.exit(1))
  })
