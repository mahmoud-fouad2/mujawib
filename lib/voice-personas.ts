/**
 * The platform's default voice assistants.
 *
 * Ten presets a business picks from at signup, in the public demo, or as the
 * starting point for its own assistant. They are deliberately **not**
 * industry-specific: a persona is a voice, a dialect and a manner of speaking.
 * What the assistant knows and is allowed to do comes from the workspace's own
 * knowledge and tool bindings, not from here.
 *
 * On voices, stated plainly rather than implied: the provider offers fewer
 * distinct voices than this list has personas, so several personas share one.
 * `providerVoice` records which, the console shows it, and an operator can
 * reassign it after listening. The alternative — quietly mapping ten names
 * onto two voices — sells a distinction the caller cannot hear.
 *
 * Only voices this codebase has actually used are seeded here. Adding another
 * is a one-field change once someone has confirmed the provider accepts it.
 */

export type PersonaGender = 'male' | 'female'
export type PersonaLanguage = 'ar' | 'en'

export type VoicePersona = {
  /** Stable key. Seeded by migration and safe to reference from code. */
  key: string
  name: string
  /** What the operator picking it needs to know in one line. */
  description: string
  gender: PersonaGender
  language: PersonaLanguage
  country: string
  dialect: string
  style: string
  /** The provider voice that actually speaks. Shown in the console. */
  providerVoice: string
  policy: Record<string, unknown>
  pacing: Record<string, unknown>
  sortOrder: number
}

/**
 * Turn-detection defaults, tuned per dialect rather than shared.
 *
 * A speaker of Gulf Arabic pauses mid-sentence more than the provider's
 * English-derived defaults expect, so a shorter silence window cuts them off.
 * These are starting points an operator can override per profile.
 */
export const PACING_MEASURED = {
  responseLength: 'short',
  vadThreshold: 0.5,
  prefixPaddingMs: 240,
  silenceDurationMs: 680,
  idleTimeoutMs: 8_000,
  bargeIn: true,
}

export const PACING_BRISK = {
  responseLength: 'short',
  vadThreshold: 0.48,
  prefixPaddingMs: 220,
  silenceDurationMs: 580,
  idleTimeoutMs: 7_000,
  bargeIn: true,
}

export const ARABIC_POLICY = {
  primary: 'ar',
  switchToEnglish: 'on_caller_request',
  brandNames: 'keep_latin',
}

const ENGLISH_POLICY = {
  primary: 'en',
  switchToEnglish: 'always',
  brandNames: 'keep_latin',
}

export const DEFAULT_VOICE_PERSONAS: VoicePersona[] = [
  {
    key: 'sara-sa',
    name: 'سارة — السعودية',
    description: 'لهجة سعودية بيضاء، نبرة ودودة ومهنية. مناسبة لأغلب المنشآت السعودية.',
    gender: 'female',
    language: 'ar',
    country: 'SA',
    dialect: 'saudi',
    style: 'warm',
    providerVoice: 'marin',
    policy: ARABIC_POLICY,
    pacing: PACING_MEASURED,
    sortOrder: 10,
  },
  {
    key: 'nasser-sa',
    name: 'ناصر — السعودي',
    description: 'لهجة سعودية بيضاء، نبرة رصينة. مناسبة للجهات الرسمية والخدمات المالية.',
    gender: 'male',
    language: 'ar',
    country: 'SA',
    dialect: 'saudi',
    style: 'professional',
    providerVoice: 'cedar',
    policy: ARABIC_POLICY,
    pacing: PACING_MEASURED,
    sortOrder: 20,
  },
  {
    key: 'lina-gulf',
    name: 'لينا — الخليجية',
    description: 'لهجة خليجية مفهومة في المنطقة كلها، موجزة وسريعة.',
    gender: 'female',
    language: 'ar',
    country: 'AE',
    dialect: 'gulf',
    style: 'concise',
    providerVoice: 'marin',
    policy: ARABIC_POLICY,
    pacing: PACING_BRISK,
    sortOrder: 30,
  },
  {
    key: 'rashed-gulf',
    name: 'راشد — الخليجي',
    description: 'لهجة خليجية، نبرة مباشرة بلا إطالة.',
    gender: 'male',
    language: 'ar',
    country: 'AE',
    dialect: 'gulf',
    style: 'concise',
    providerVoice: 'cedar',
    policy: ARABIC_POLICY,
    pacing: PACING_BRISK,
    sortOrder: 40,
  },
  {
    key: 'maryam-eg',
    name: 'مريم — المصرية',
    description: 'لهجة مصرية واضحة وودودة، بلا مبالغة في التعابير المحلية.',
    gender: 'female',
    language: 'ar',
    country: 'EG',
    dialect: 'egyptian',
    style: 'warm',
    providerVoice: 'marin',
    policy: ARABIC_POLICY,
    pacing: PACING_BRISK,
    sortOrder: 50,
  },
  {
    key: 'omar-eg',
    name: 'عمر — المصري',
    description: 'لهجة مصرية مهنية، مناسبة للدعم والمبيعات.',
    gender: 'male',
    language: 'ar',
    country: 'EG',
    dialect: 'egyptian',
    style: 'professional',
    providerVoice: 'cedar',
    policy: ARABIC_POLICY,
    pacing: PACING_BRISK,
    sortOrder: 60,
  },
  {
    key: 'nadine-lb',
    name: 'نادين — اللبنانية',
    description: 'لهجة لبنانية خفيفة ومهذبة، مع وضوح عربي واسع الفهم.',
    gender: 'female',
    language: 'ar',
    country: 'LB',
    dialect: 'lebanese',
    style: 'premium',
    providerVoice: 'marin',
    policy: ARABIC_POLICY,
    pacing: PACING_MEASURED,
    sortOrder: 70,
  },
  {
    key: 'karim-lb',
    name: 'كريم — اللبناني',
    description: 'لهجة لبنانية راقية ومتأنية، مناسبة للخدمات المميزة.',
    gender: 'male',
    language: 'ar',
    country: 'LB',
    dialect: 'lebanese',
    style: 'premium',
    providerVoice: 'cedar',
    policy: ARABIC_POLICY,
    pacing: PACING_MEASURED,
    sortOrder: 80,
  },
  {
    key: 'emma-en',
    name: 'Emma — English',
    description: 'Clear neutral English. For businesses serving non-Arabic speakers.',
    gender: 'female',
    language: 'en',
    country: 'SA',
    dialect: 'msa',
    style: 'professional',
    providerVoice: 'marin',
    policy: ENGLISH_POLICY,
    pacing: PACING_BRISK,
    sortOrder: 90,
  },
  {
    key: 'adam-en',
    name: 'Adam — English',
    description: 'Clear neutral English, measured tone. Suits formal or technical calls.',
    gender: 'male',
    language: 'en',
    country: 'SA',
    dialect: 'msa',
    style: 'professional',
    providerVoice: 'cedar',
    policy: ENGLISH_POLICY,
    pacing: PACING_MEASURED,
    sortOrder: 100,
  },
]

export const PERSONA_GENDER_LABEL: Record<PersonaGender, string> = {
  female: 'أنثى',
  male: 'ذكر',
}

export const PERSONA_LANGUAGE_LABEL: Record<PersonaLanguage, string> = {
  ar: 'العربية',
  en: 'الإنجليزية',
}

/**
 * Readable dialect names, so a signup screen never shows a raw key.
 *
 * Falls back to the key itself through `dialectLabel` rather than an empty
 * string: a workspace's own custom profile can carry a dialect this map does
 * not know, and showing "gulf" is better than showing nothing.
 */
export const PERSONA_DIALECT_LABEL: Record<string, string> = {
  saudi: 'سعودي',
  gulf: 'خليجي',
  egyptian: 'مصري',
  lebanese: 'لبناني',
  msa: 'فصحى',
  english: 'إنجليزي',
}

export function dialectLabel(dialect: string): string {
  return PERSONA_DIALECT_LABEL[dialect] ?? dialect
}

/**
 * How many personas share each provider voice.
 *
 * Used by the console to say so out loud. An operator choosing between Sara
 * and Lina should know the difference is dialect and pacing, not timbre.
 */
export function personasPerProviderVoice(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const persona of DEFAULT_VOICE_PERSONAS) {
    counts[persona.providerVoice] = (counts[persona.providerVoice] ?? 0) + 1
  }
  return counts
}

export function personaByKey(key: string): VoicePersona | null {
  return DEFAULT_VOICE_PERSONAS.find((persona) => persona.key === key) ?? null
}
