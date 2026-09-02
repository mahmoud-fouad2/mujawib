import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_PERSONAS,
  personaByKey,
  personasPerProviderVoice,
} from '@/lib/voice-personas'

describe('default voice personas', () => {
  it('ships the ten the product promises', () => {
    expect(DEFAULT_VOICE_PERSONAS).toHaveLength(10)
  })

  it('covers every dialect in both genders', () => {
    // The product offers a choice of gender per dialect. A missing pair is a
    // promise the signup screen cannot keep.
    const pairs = new Map<string, Set<string>>()
    for (const persona of DEFAULT_VOICE_PERSONAS) {
      const key = `${persona.language}:${persona.dialect}`
      const genders = pairs.get(key) ?? new Set()
      genders.add(persona.gender)
      pairs.set(key, genders)
    }
    for (const [group, genders] of pairs) {
      expect([...genders].sort(), `${group} needs both genders`).toEqual(['female', 'male'])
    }
  })

  it('includes both Arabic and English', () => {
    const languages = new Set(DEFAULT_VOICE_PERSONAS.map((p) => p.language))
    expect([...languages].sort()).toEqual(['ar', 'en'])
  })

  it('gives every persona a stable, unique key', () => {
    // The key is what the seeding migration conflicts on. A duplicate would
    // make the seed silently drop a persona; a changed one would create a
    // second copy on the next deploy.
    const keys = DEFAULT_VOICE_PERSONAS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z]+-[a-z]{2,4}$/)
  })

  it('gives every persona a name and a description an operator can choose by', () => {
    for (const persona of DEFAULT_VOICE_PERSONAS) {
      expect(persona.name.length).toBeGreaterThan(3)
      expect(persona.description.length).toBeGreaterThan(20)
    }
  })

  it('assigns a provider voice explicitly rather than leaving it implied', () => {
    for (const persona of DEFAULT_VOICE_PERSONAS) {
      expect(persona.providerVoice).toBeTruthy()
    }
  })

  it('only uses provider voices this codebase has actually run', () => {
    // Naming a voice the provider does not accept fails the call, not the
    // build. Restricting the seed to voices already proven in the runtime is
    // the difference between a configuration typo and a dead call.
    const proven = new Set(['cedar', 'marin'])
    for (const persona of DEFAULT_VOICE_PERSONAS) {
      expect(proven, `${persona.key} uses an unproven voice`).toContain(persona.providerVoice)
    }
  })

  it('reports how many personas share each provider voice', () => {
    // The console shows this. Ten names over two voices is a real limitation,
    // and stating it is what stops the product promising a distinction the
    // caller cannot hear.
    const counts = personasPerProviderVoice()
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(10)
    expect(Object.keys(counts).length).toBeLessThan(DEFAULT_VOICE_PERSONAS.length)
  })

  it('orders deterministically so the picker does not reshuffle', () => {
    const orders = DEFAULT_VOICE_PERSONAS.map((p) => p.sortOrder)
    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('looks a persona up by key, and returns null for an unknown one', () => {
    expect(personaByKey('sara-sa')?.gender).toBe('female')
    expect(personaByKey('nasser-sa')?.gender).toBe('male')
    expect(personaByKey('does-not-exist')).toBeNull()
  })

  it('gives every persona turn-detection settings', () => {
    // A persona with no pacing falls back to provider defaults tuned for
    // English, which cut Arabic speakers off mid-sentence.
    for (const persona of DEFAULT_VOICE_PERSONAS) {
      expect(persona.pacing.silenceDurationMs).toBeGreaterThan(300)
      expect(persona.pacing.bargeIn).toBe(true)
    }
  })
})
