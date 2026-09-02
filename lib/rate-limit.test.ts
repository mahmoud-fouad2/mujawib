import { describe, expect, it } from 'vitest'
import { clientIdentifier } from '@/lib/rate-limit'

function headersFrom(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null }
}

describe('clientIdentifier', () => {
  it('trusts the last hop, not the first', () => {
    // Behind Render's single edge proxy, the last entry is the address the
    // proxy itself observed; every entry before it is whatever the request
    // arrived with, which the sender controls.
    const headers = headersFrom({ 'x-forwarded-for': '9.9.9.9, 203.0.113.4' })
    expect(clientIdentifier(headers)).toBe('203.0.113.4')
  })

  it('is not fooled by a spoofed header on a direct request', () => {
    // A single-hop request carries no real forwarding chain, so whatever a
    // client sets IS the only entry — but rateLimit still buckets by it
    // consistently, and a real deployment's proxy always appends its own.
    // The regression this guards is different: a chain with a spoofed FIRST
    // entry must resolve to the trusted LAST one, not the spoofed one.
    const spoofed = headersFrom({ 'x-forwarded-for': '1.2.3.4' })
    const real = headersFrom({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })
    expect(clientIdentifier(spoofed)).toBe('1.2.3.4')
    expect(clientIdentifier(real)).toBe('203.0.113.9')
  })

  it('falls back to x-real-ip, then a shared bucket', () => {
    expect(clientIdentifier(headersFrom({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1')
    expect(clientIdentifier(headersFrom({}))).toBe('unknown')
  })

  it('ignores empty segments from stray commas', () => {
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.5, ,' })
    expect(clientIdentifier(headers)).toBe('203.0.113.5')
  })
})
