export type VoicePersonaKey = 'formal' | 'natural' | 'saudi' | 'gulf' | 'lebanese' | 'egyptian'

export type VoicePersona = {
  key: VoicePersonaKey
  label: string
  description: string
  defaultAgentName: string
  country: string
  dialect: string
  style: string
  policy: Record<string, unknown>
  pacing: Record<string, unknown>
}

export const DEFAULT_VOICE_PERSONAS: VoicePersona[] = [
  {
    key: 'formal',
    label: 'رسمي واضح',
    description: 'نبرة منظمة مناسبة للبنوك، الشركات، والجهات التي تحتاج حضورًا رسميًا.',
    defaultAgentName: 'محمد — رسمي واضح',
    country: 'SA',
    dialect: 'msa',
    style: 'professional',
    policy: { primary: 'ar', switchToEnglish: 'on_caller_request', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'short',
      pauseMs: 220,
      vadThreshold: 0.5,
      prefixPaddingMs: 220,
      silenceDurationMs: 520,
      idleTimeoutMs: 7_000,
      bargeIn: true,
    },
  },
  {
    key: 'natural',
    label: 'طبيعي ودود',
    description: 'أسلوب عربي بسيط وقريب لخدمة العملاء والحجوزات اليومية.',
    defaultAgentName: 'ياسمين — طبيعي ودود',
    country: 'SA',
    dialect: 'msa',
    style: 'warm',
    policy: { primary: 'ar', switchToEnglish: 'on_caller_request', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'short',
      pauseMs: 220,
      vadThreshold: 0.48,
      prefixPaddingMs: 240,
      silenceDurationMs: 500,
      idleTimeoutMs: 6_500,
      bargeIn: true,
    },
  },
  {
    key: 'saudi',
    label: 'سعودي واضح',
    description: 'لهجة سعودية بيضاء ومباشرة للمنشآت السعودية وكل القطاعات المحلية.',
    defaultAgentName: 'ياسمين — سعودي واضح',
    country: 'SA',
    dialect: 'saudi',
    style: 'warm',
    policy: { primary: 'ar-SA', switchToEnglish: 'on_caller_request', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'short',
      pauseMs: 200,
      vadThreshold: 0.48,
      prefixPaddingMs: 230,
      silenceDurationMs: 500,
      idleTimeoutMs: 6_500,
      bargeIn: true,
    },
  },
  {
    key: 'gulf',
    label: 'خليجي مختصر',
    description: 'ردود سريعة ومباشرة بلهجة خليجية بيضاء.',
    defaultAgentName: 'محمد — خليجي مختصر',
    country: 'AE',
    dialect: 'gulf',
    style: 'concise',
    policy: { primary: 'ar-AE', switchToEnglish: 'mixed_allowed', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'very_short',
      pauseMs: 180,
      vadThreshold: 0.48,
      prefixPaddingMs: 220,
      silenceDurationMs: 460,
      idleTimeoutMs: 6_000,
      bargeIn: true,
    },
  },
  {
    key: 'lebanese',
    label: 'لبناني راقٍ',
    description: 'نبرة لبنانية خفيفة ومهذبة للمبيعات، الضيافة، والخدمات الراقية.',
    defaultAgentName: 'ياسمين — لبناني راقٍ',
    country: 'LB',
    dialect: 'lebanese',
    style: 'premium',
    policy: { primary: 'ar-LB', switchToEnglish: 'mixed_allowed', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'short',
      pauseMs: 240,
      vadThreshold: 0.5,
      prefixPaddingMs: 250,
      silenceDurationMs: 540,
      idleTimeoutMs: 7_000,
      bargeIn: true,
    },
  },
  {
    key: 'egyptian',
    label: 'مصري مريح',
    description: 'لهجة مصرية خفيفة ومفهومة، مناسبة للدعم والمبيعات والاستفسارات.',
    defaultAgentName: 'ياسمين — مصري مريح',
    country: 'EG',
    dialect: 'egyptian',
    style: 'warm',
    policy: { primary: 'ar-EG', switchToEnglish: 'on_caller_request', brandNames: 'keep_latin' },
    pacing: {
      responseLength: 'short',
      pauseMs: 240,
      vadThreshold: 0.5,
      prefixPaddingMs: 250,
      silenceDurationMs: 540,
      idleTimeoutMs: 7_000,
      bargeIn: true,
    },
  },
]

export type VoiceProfileLike = {
  id: string
  name: string
  dialect: string
  style: string
}

export function profileMatchesPersona(profile: VoiceProfileLike, key: VoicePersonaKey) {
  if (key === 'formal') {
    return profile.dialect === 'msa' || /رسمي|فصحى|formal/i.test(profile.name)
  }
  if (key === 'natural') {
    return /طبيعي|ودود|natural|warm/i.test(profile.name)
  }
  if (key === 'saudi') return profile.dialect === 'saudi' || /سعودي|saudi/i.test(profile.name)
  if (key === 'gulf') return profile.dialect === 'gulf' || /خليجي|gulf/i.test(profile.name)
  if (key === 'lebanese') {
    return profile.dialect === 'lebanese' || /لبناني|lebanese/i.test(profile.name)
  }
  return profile.dialect === 'egyptian' || /مصري|egyptian/i.test(profile.name)
}

export function personaByKey(key: VoicePersonaKey): VoicePersona {
  return DEFAULT_VOICE_PERSONAS.find((persona) => persona.key === key) ?? DEFAULT_VOICE_PERSONAS[0]!
}
