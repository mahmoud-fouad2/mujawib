import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { outboundDialerStatus, placeOutboundCall } from '@/server/outbound/dialer'

/**
 * The safety property of the whole outbound feature, asserted directly: with
 * no credentials configured, nothing in this product can ring a phone.
 *
 * These tests never reach the network. `placeOutboundCall` is expected to
 * refuse before it builds a request at all, which is exactly what makes the
 * refusal testable without a provider.
 */

const KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'OPENAI_PROJECT_ID', 'OPENAI_SIP_URI']
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function configure() {
  process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000'
  process.env.TWILIO_AUTH_TOKEN = 'token'
  process.env.OPENAI_PROJECT_ID = 'proj_test'
}

describe('outbound dialer readiness', () => {
  it('is not ready on a deployment with nothing configured', () => {
    const status = outboundDialerStatus()
    expect(status.ready).toBe(false)
    expect(status.missing).toEqual(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'OPENAI_PROJECT_ID'])
  })

  it('names each missing piece rather than reporting a bare false', () => {
    // The UI prints these. "Not configured" with no list is a support ticket.
    process.env.TWILIO_ACCOUNT_SID = 'AC1'
    expect(outboundDialerStatus().missing).toEqual(['TWILIO_AUTH_TOKEN', 'OPENAI_PROJECT_ID'])
  })

  it('accepts an explicit SIP URI in place of a project id', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.OPENAI_SIP_URI = 'sip:proj_x@sip.api.openai.com;transport=tls'
    expect(outboundDialerStatus().ready).toBe(true)
  })

  it('never claims the path has been proven in production', () => {
    // This deployment has never placed an outbound call. The flag exists so
    // no screen can imply otherwise.
    configure()
    expect(outboundDialerStatus().verified).toBe(false)
  })
})

describe('placing a call', () => {
  it('refuses outright when the dialer is not configured', async () => {
    const result = await placeOutboundCall({
      to: '+966501234567',
      from: '+966500000000',
      reference: 'att_1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.retryable).toBe(false)
      expect(result.error).toContain('TWILIO_ACCOUNT_SID')
    }
  })

  it('refuses a malformed destination even when configured', async () => {
    configure()
    for (const to of ['0501234567', 'not-a-number', '+0501234567', '']) {
      const result = await placeOutboundCall({ to, from: '+966500000000', reference: 'att_1' })
      expect(result.ok, `${to} should be refused`).toBe(false)
    }
  })

  it('refuses a malformed caller id even when the destination is fine', async () => {
    configure()
    const result = await placeOutboundCall({
      to: '+966501234567',
      from: 'not-a-number',
      reference: 'att_1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.retryable).toBe(false)
  })
})
