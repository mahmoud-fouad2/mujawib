type TranscriptRole = 'caller' | 'agent'

export type TranscriptTurn = {
  role: TranscriptRole
  text: string
  at: number
}

export type CallSummary = {
  headline: string
  callerNeed: string | null
  resolution: string
  nextAction: string | null
  callerHighlights: string[]
  agentHighlights: string[]
  warnings: string[]
  source: 'recorded' | 'derived' | 'pending'
  urgency: 'low' | 'medium' | 'high' | null
  followUpRequired: boolean | null
}

type SummaryInput = {
  status: string
  outcome: string | null
  intent: string | null
  endedAt: Date | string | null
  metadata: Record<string, unknown> | null
  transcript: TranscriptTurn[]
  booking: { service?: string | null; status?: string | null } | null
  lead: { interest?: string | null; status?: string | null } | null
  tools: { toolName: string; status: 'running' | 'succeeded' | 'failed' }[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function safeText(value: unknown, max = 600): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : null
}

function textFromContent(value: unknown): string | null {
  const direct = safeText(value)
  if (direct) return direct
  if (!Array.isArray(value)) return null

  const parts = value
    .map((item) => {
      const record = asRecord(item)
      return record ? (safeText(record.text) ?? safeText(record.transcript)) : null
    })
    .filter((item): item is string => Boolean(item))

  return parts.length ? parts.join(' ').slice(0, 600) : null
}

function roleFrom(value: unknown): TranscriptRole | null {
  if (value === 'caller' || value === 'user' || value === 'customer') return 'caller'
  if (value === 'agent' || value === 'assistant' || value === 'ai') return 'agent'
  return null
}

function offsetSeconds(record: Record<string, unknown>): number {
  const seconds = record.at ?? record.atSeconds ?? record.offsetSeconds ?? record.time
  if (typeof seconds === 'number' && Number.isFinite(seconds)) return Math.max(0, seconds)

  const milliseconds = record.atMs ?? record.offsetMs ?? record.offset_ms
  if (typeof milliseconds === 'number' && Number.isFinite(milliseconds)) {
    return Math.max(0, milliseconds / 1000)
  }

  return 0
}

/**
 * Realtime and imported transcripts do not always use the same role or text
 * fields. Normalize defensively at the read boundary so malformed provider
 * payloads cannot break Calls Inbox and provider vocabulary never leaks into
 * the UI.
 */
export function normalizeTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      const role = roleFrom(record.role ?? record.speaker)
      const text =
        safeText(record.text) ??
        safeText(record.transcript) ??
        textFromContent(record.content) ??
        safeText(record.message)
      if (!role || !text) return null
      return { role, text, at: offsetSeconds(record) }
    })
    .filter((item): item is TranscriptTurn => Boolean(item))
    .sort((a, b) => a.at - b.at)
}

function highlights(transcript: TranscriptTurn[], role: TranscriptRole): string[] {
  return transcript
    .filter((turn) => turn.role === role)
    .map((turn) => turn.text)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 2)
}

function explicitSummary(
  metadata: Record<string, unknown> | null,
): Pick<
  CallSummary,
  'headline' | 'resolution' | 'callerNeed' | 'nextAction' | 'urgency' | 'followUpRequired'
> | null {
  const summary = asRecord(metadata?.summary)
  if (!summary) return null

  const headline = safeText(summary.headline, 160)
  const resolution = safeText(summary.resolution, 400)
  if (!headline || !resolution) return null

  return {
    headline,
    resolution,
    callerNeed: safeText(summary.callerNeed, 400),
    nextAction: safeText(summary.nextAction, 400),
    urgency:
      summary.urgency === 'low' || summary.urgency === 'medium' || summary.urgency === 'high'
        ? summary.urgency
        : null,
    followUpRequired:
      typeof summary.followUpRequired === 'boolean' ? summary.followUpRequired : null,
  }
}

/**
 * Produces a truthful operational brief from stored evidence. It never turns
 * an outcome label into a booking or lead unless the corresponding business
 * record exists. A later post-call processor may persist a richer summary in
 * metadata.summary; this reader will prefer it without changing the UI API.
 */
export function buildCallSummary(input: SummaryInput): CallSummary {
  const callerHighlights = highlights(input.transcript, 'caller')
  const agentHighlights = highlights(input.transcript, 'agent')
  const recorded = explicitSummary(input.metadata)
  const failedTools = input.tools.filter((tool) => tool.status === 'failed')
  const warnings: string[] = []

  if (input.transcript.length === 0) {
    warnings.push(
      input.status === 'completed_no_transcript'
        ? 'المكالمة تم قبولها وتسجيلها، لكن نص الحوار غير متاح بعد.'
        : 'نص الحوار غير متاح لهذه المكالمة.',
    )
  }
  if (failedTools.length > 0) warnings.push(`${failedTools.length} إجراء لم يكتمل بنجاح.`)
  if (!input.endedAt && input.status === 'live') {
    warnings.push('لم تصل إشارة نهاية المكالمة بعد؛ لا يمكن اعتماد نتيجة نهائية.')
  }

  if (recorded) {
    return {
      ...recorded,
      callerHighlights,
      agentHighlights,
      warnings,
      source: 'recorded',
    }
  }

  const callerNeed = input.intent ?? callerHighlights[0] ?? null
  let headline = 'مكالمة تحتاج استكمال السجل'
  let resolution = 'لا توجد نتيجة تشغيلية مؤكدة بعد.'
  let nextAction: string | null = 'راجع المكالمة وحدد النتيجة والخطوة التالية.'

  switch (input.outcome) {
    case 'booking':
      if (input.booking) {
        headline = 'تم إنشاء حجز'
        resolution = input.booking.service
          ? `أُنشئ سجل حجز لخدمة ${input.booking.service}.`
          : 'أُنشئ سجل حجز مرتبط بالمكالمة.'
        nextAction = null
      } else {
        headline = 'نتيجة الحجز تحتاج تحققًا'
        resolution = 'سُجلت النتيجة كحجز، لكن لا يوجد سجل حجز مرتبط يثبت التنفيذ.'
        warnings.push('لا يوجد سجل حجز مؤكد.')
      }
      break
    case 'lead':
      if (input.lead) {
        headline = 'تم تسجيل فرصة متابعة'
        resolution = input.lead.interest
          ? `سُجل اهتمام العميل بـ ${input.lead.interest}.`
          : 'أُنشئ سجل عميل محتمل مرتبط بالمكالمة.'
        nextAction = 'يتابع الفريق فرصة العميل حسب آلية العمل.'
      } else {
        headline = 'الفرصة تحتاج تحققًا'
        resolution = 'سُجلت النتيجة كفرصة، لكن لا يوجد سجل عميل محتمل مرتبط.'
        warnings.push('لا يوجد سجل عميل محتمل مؤكد.')
      }
      break
    case 'callback':
      headline = 'طلب معاودة اتصال'
      resolution = 'انتهت المكالمة بطلب متابعة من الفريق.'
      nextAction = 'عيّن الطلب لموظف وتأكد من إغلاق المتابعة.'
      break
    case 'transfer':
      headline = 'تم تحويل المكالمة'
      resolution = 'احتاج الطلب تدخلًا بشريًا وتم تحويل مساره للفريق.'
      nextAction = 'تحقق من استلام الفريق ونتيجة التحويل.'
      break
    case 'resolved':
      headline = 'أُنجز طلب المتصل'
      resolution = 'سُجلت المكالمة كمنجزة دون حاجة إلى متابعة إضافية.'
      nextAction = null
      break
    case 'failed':
    case 'unresolved':
      headline = 'لم يكتمل طلب المتصل'
      resolution = 'انتهت المكالمة دون نتيجة مكتملة.'
      nextAction = 'راجع سبب التعثر وأنشئ إجراء متابعة واضحًا.'
      break
    default:
      if (input.status === 'live') {
        headline = 'المكالمة مسجلة كجارية'
        resolution = 'تم قبول المكالمة، لكن بيانات النهاية والنتيجة لم تصل بعد.'
        nextAction = 'استكمل ربط أحداث نهاية المكالمة قبل اعتماد الملخص.'
      } else if (input.status === 'completed') {
        headline = 'انتهت بلا نتيجة مسجلة'
        resolution = 'المكالمة مكتملة تقنيًا، لكن نتيجتها التشغيلية غير محددة.'
      } else if (input.status === 'completed_no_transcript') {
        // The call itself worked; what is missing is our recording of it.
        headline = 'تم استقبال المكالمة والرد عليها'
        resolution =
          'قبلت المنصة المكالمة ورد عليها الموظف الصوتي، لكن لم يصل نص الحوار قبل انتهاء الجلسة.'
        nextAction = 'راجع اتصال الجلسة الجانبية حتى تُحفظ نصوص المكالمات القادمة.'
      } else if (input.status === 'accept_failed') {
        headline = 'لم تُقبل المكالمة'
        resolution = 'وصلت المكالمة إلى المنصة لكن تعذّر بدء جلسة الرد، فلم يسمع المتصل الموظف.'
        nextAction = 'راجع سجل القبول ومفاتيح الاتصال بمزوّد الصوت.'
      } else if (input.status === 'route_failed') {
        headline = 'لم يُعرف الرقم المطلوب'
        resolution = 'وصلت مكالمة على رقم غير مربوط بأي عميل، فرُفضت بدل الرد عليها بموظف خاطئ.'
        nextAction = 'اربط الرقم بعميل وموظف صوتي منشور، أو تجاهل المكالمة.'
      }
  }

  return {
    headline,
    callerNeed,
    resolution,
    nextAction,
    callerHighlights,
    agentHighlights,
    warnings,
    source: input.status === 'live' && !input.endedAt ? 'pending' : 'derived',
    urgency: null,
    followUpRequired: nextAction !== null,
  }
}
