import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVerificationSms, sendVerificationSms, smsStatus } from '@/server/outbound/sms'

const KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']
const saved: Record<string, string | undefined> = {}

const VALID_SID = 'AC00000000000000000000000000000000'
const VALID_TOKEN = 'auth-token-123456789'
const VALID_SERVICE_SID = 'VA11112222333344445555666677778888'

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function configureValid() {
  process.env.TWILIO_ACCOUNT_SID = VALID_SID
  process.env.TWILIO_AUTH_TOKEN = VALID_TOKEN
  process.env.TWILIO_VERIFY_SERVICE_SID = VALID_SERVICE_SID
}

describe('sms readiness and configuration', () => {
  it('is not ready on a deployment with nothing configured', () => {
    const status = smsStatus()
    expect(status.ready).toBe(false)
    expect(status.missing).toEqual([
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_VERIFY_SERVICE_SID',
    ])
    expect(status.malformed).toEqual([])
  })

  it('reports missing when only some credentials are set', () => {
    process.env.TWILIO_ACCOUNT_SID = VALID_SID
    const status = smsStatus()
    expect(status.ready).toBe(false)
    expect(status.missing).toEqual(['TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'])
  })

  it('rejects a malformed TWILIO_VERIFY_SERVICE_SID', () => {
    process.env.TWILIO_ACCOUNT_SID = VALID_SID
    process.env.TWILIO_AUTH_TOKEN = VALID_TOKEN
    process.env.TWILIO_VERIFY_SERVICE_SID = 'MG123456' // Not a VA + 32 hex SID

    const status = smsStatus()
    expect(status.ready).toBe(false)
    expect(status.missing).toEqual([])
    expect(status.malformed).toEqual([
      {
        key: 'TWILIO_VERIFY_SERVICE_SID',
        expected: 'VA + 32 hex characters (a Twilio Verify Service SID)',
      },
    ])
  })

  it('reports ready when all credentials are set and shaped correctly', () => {
    configureValid()
    const status = smsStatus()
    expect(status.ready).toBe(true)
    expect(status.missing).toEqual([])
    expect(status.malformed).toEqual([])
  })
})

describe('sendVerificationSms (Send OTP)', () => {
  it('refuses when credentials are not configured', async () => {
    const result = await sendVerificationSms('+966501234567')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('التحقق غير مُهيّأ')
    }
  })

  it('refuses an invalid phone number format', async () => {
    configureValid()
    const result = await sendVerificationSms('0501234567') // Not E.164
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('رقم غير صالح')
    }
  })

  it('sends OTP successfully via Twilio Verify API', async () => {
    configureValid()
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: HeadersInit | undefined
    let capturedBody = ''

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url)
        capturedMethod = init?.method ?? 'GET'
        capturedHeaders = init?.headers
        capturedBody = String(init?.body ?? '')
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ sid: 'VE123', status: 'pending' }),
        } as unknown as Response
      }),
    )

    const result = await sendVerificationSms('+966501234567')
    expect(result).toEqual({ ok: true, status: 'pending' })
    expect(capturedUrl).toBe(
      `https://verify.twilio.com/v2/Services/${VALID_SERVICE_SID}/Verifications`,
    )
    expect(capturedMethod).toBe('POST')
    expect(capturedBody).toContain('To=%2B966501234567')
    expect(capturedBody).toContain('Channel=sms')

    const headers = capturedHeaders as Record<string, string>
    expect(headers.Authorization).toMatch(/^Basic /)
  })

  it('handles Twilio API errors gracefully', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ message: 'Invalid parameter', code: 60200 }),
        } as unknown as Response
      }),
    )

    const result = await sendVerificationSms('+966501234567')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('400')
    }
  })

  it('handles Twilio 404 response on send', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        } as unknown as Response
      }),
    )

    const result = await sendVerificationSms('+966501234567')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('تعذّر بدء التحقق')
    }
  })

  it('handles network timeouts during send', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('AbortError')
        error.name = 'AbortError'
        throw error
      }),
    )

    const result = await sendVerificationSms('+966501234567')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('انتهت مهلة الاتصال بمزوّد التحقق')
    }
  })
})

describe('checkVerificationSms (Verify OTP Code)', () => {
  it('refuses when credentials are not configured', async () => {
    const result = await checkVerificationSms('+966501234567', '123456')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('التحقق غير مُهيّأ')
    }
  })

  it('refuses invalid phone numbers and malformed codes', async () => {
    configureValid()
    const badPhone = await checkVerificationSms('0501234567', '123456')
    expect(badPhone).toEqual({ ok: false, error: 'رقم غير صالح' })

    const badCode = await checkVerificationSms('+966501234567', 'abc')
    expect(badCode).toEqual({ ok: false, error: 'رمز غير صالح' })
  })

  it('returns approved: true when Twilio approves the correct code', async () => {
    configureValid()
    let capturedUrl = ''
    let capturedBody = ''

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url)
        capturedBody = String(init?.body ?? '')
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'approved', valid: true }),
        } as unknown as Response
      }),
    )

    const result = await checkVerificationSms('+966501234567', '123456')
    expect(result).toEqual({ ok: true, approved: true })
    expect(capturedUrl).toBe(
      `https://verify.twilio.com/v2/Services/${VALID_SERVICE_SID}/VerificationCheck`,
    )
    expect(capturedBody).toContain('To=%2B966501234567')
    expect(capturedBody).toContain('Code=123456')
  })

  it('returns approved: false when code is incorrect (status: pending)', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'pending', valid: false }),
        } as unknown as Response
      }),
    )

    const result = await checkVerificationSms('+966501234567', '999999')
    expect(result).toEqual({ ok: true, approved: false })
  })

  it('returns approved: false when code is expired or not found (404)', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ message: 'Verification expired or not found' }),
        } as unknown as Response
      }),
    )

    const result = await checkVerificationSms('+966501234567', '123456')
    expect(result).toEqual({ ok: true, approved: false })
  })

  it('handles Twilio 500 error as a provider failure', async () => {
    configureValid()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as unknown as Response
      }),
    )

    const result = await checkVerificationSms('+966501234567', '123456')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('500')
    }
  })
})
