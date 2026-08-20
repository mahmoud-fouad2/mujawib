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

export const TOOL_DEFINITIONS = [
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
        customerName: { type: 'string' },
        customerPhone: { type: 'string', description: 'رقم الجوال كما أملاه المتصل' },
        branch: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['service', 'slot', 'customerName', 'customerPhone'],
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
   * Executing a tool call requires the sideband connection, which is not
   * deployed yet. Offering a tool the model can call but nothing can answer
   * would leave the caller in silence waiting for a result that never arrives,
   * which is worse than an agent that simply talks. So an unbound version is
   * conversation-only by construction.
   */
  if (active.length === 0) return []

  const has = (p: string) => active.some((b) => b.includes(p))
  const enabled = new Set<ToolName>(['create_callback', 'transfer_to_human'])

  if (has('calendar') || has('microsoft')) {
    enabled.add('check_availability')
    enabled.add('create_booking')
  }
  if (has('whatsapp')) enabled.add('send_confirmation')

  return TOOL_DEFINITIONS.filter((t) => enabled.has(t.name as ToolName))
}
