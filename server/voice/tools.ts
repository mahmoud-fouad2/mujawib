import 'server-only'

/**
 * Universal tool definitions handed to the Realtime session.
 *
 * These are the actions the agent may take. Bible §12: no business action is
 * confirmed to the caller before its tool returns a genuine success, so every
 * handler below either succeeds truthfully or reports failure — none of them
 * returns an optimistic result.
 */

export type ToolName =
  | 'check_availability'
  | 'create_booking'
  | 'send_confirmation'
  | 'create_callback'
  | 'transfer_to_human'

const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    name: 'check_availability',
    description:
      'يتحقق من المواعيد المتاحة في تقويم الشركة. استدعه قبل أي عرض لموعد. لا تذكر أي وقت للمتصل قبل رجوع هذه الأداة.',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'اسم الخدمة كما هو مسجّل في المعرفة' },
        preferredDate: {
          type: 'string',
          description: 'اليوم المفضل بصيغة YYYY-MM-DD، أو كلمة مثل today/tomorrow',
        },
        preferredPeriod: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'any'],
          description: 'الفترة المفضلة إن ذكرها المتصل',
        },
        branch: { type: 'string', description: 'الفرع إن حدده المتصل' },
      },
      required: ['service', 'preferredDate'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'create_booking',
    description:
      'يثبّت الموعد فعليًا في التقويم. لا تقل «تم الحجز» قبل أن ترجع هذه الأداة بنجاح. تُستدعى فقط بعد check_availability.',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        slot: { type: 'string', description: 'الموعد المختار بصيغة ISO 8601' },
        availabilityToken: {
          type: 'string',
          description: 'الرمز المقابل للموعد كما أعادته check_availability دون أي تعديل',
        },
        customerName: { type: 'string' },
        customerPhone: { type: 'string', description: 'رقم الجوال كما أملاه المتصل' },
        branch: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['service', 'slot', 'customerName', 'customerPhone', 'availabilityToken'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'send_confirmation',
    description: 'يرسل رسالة تأكيد للمتصل على واتساب. يُستدعى بعد نجاح create_booking فقط.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        bookingId: { type: 'string' },
      },
      required: ['to', 'bookingId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'create_callback',
    description:
      'يسجّل طلب معاودة اتصال. استدعه عند فشل أداة، أو خارج ساعات العمل، أو عندما يتعذّر إنجاز الطلب.',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        customerPhone: { type: 'string' },
        reason: { type: 'string', description: 'سبب الطلب بلغة العمل، لا بلغة تقنية' },
      },
      required: ['customerPhone', 'reason'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'transfer_to_human',
    description:
      'يحوّل المكالمة إلى رقم الفريق. استدعه عند طلب المتصل، أو عند شكوى، أو بعد تكرار عدم الفهم.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        department: { type: 'string' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
]

/** Result shape every handler returns; the agent sees this verbatim. */
export type ToolResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; fallback: 'callback' | 'transfer' | 'retry' }

/**
 * Only the tools a version actually binds are exposed to the model. An agent
 * that cannot reach a calendar must not be offered `create_booking` — it would
 * call it and then have to walk the promise back.
 */
export function toolsFor(bindings: string[]) {
  const active = bindings.filter(Boolean)

  /**
   * A version with no bindings gets no tools at all — not even the callback and
   * transfer fallbacks.
   *
   * The sideband executes only tools explicitly bound to the published version.
   * An unbound version therefore remains conversation-only by construction.
   */
  if (active.length === 0) return []

  const has = (p: string) => active.some((b) => b.includes(p))
  const enabled = new Set<ToolName>(['create_callback', 'transfer_to_human'])

  // `rest_api`/`generic_api` carry the same capability set as a branded
  // provider (lib/integrations.ts) and findIntegration() already falls back
  // to them for every action — a workspace whose only calendar or WhatsApp
  // connection is REST-backed must not lose the tool just because its
  // binding string doesn't literally say "calendar" or "whatsapp". Whether
  // that specific connection actually has the needed endpoint configured is
  // checked again at call time by findIntegration/invokeIntegration, so
  // offering the tool here is never a false promise — a REST connection
  // bound for something unrelated (e.g. CRM only) still fails cleanly with
  // the normal "not connected" fallback if the model tries to use it.
  const hasGenericBackend = has('rest_api') || has('generic_api')

  if (has('calendar') || has('microsoft') || hasGenericBackend) {
    enabled.add('check_availability')
    enabled.add('create_booking')
  }
  if (has('whatsapp') || hasGenericBackend) enabled.add('send_confirmation')

  return TOOL_DEFINITIONS.filter((t) => enabled.has(t.name as ToolName))
}
