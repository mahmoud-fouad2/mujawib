import { describe, expect, it } from 'vitest'
import {
  duration,
  healthTone,
  maskPhone,
  num,
  outcomeTone,
  PHONE_LIFECYCLE_HINT,
  PHONE_LIFECYCLE_LABEL,
  phoneLifecycleTone,
  statusTone,
  workspaceTone,
} from './format'

describe('num', () => {
  it('renders a dash for null, undefined, and NaN rather than "0" or "NaN"', () => {
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(num(Number.NaN)).toBe('—')
  })

  it('formats a real number with Arabic-locale, Latin digits', () => {
    expect(num(1234)).toBe('1,234')
    expect(num(0)).toBe('0')
  })
})

describe('duration', () => {
  it('renders a dash for null, undefined, and NaN — never an invented duration', () => {
    expect(duration(null)).toBe('—')
    expect(duration(undefined)).toBe('—')
    expect(duration(Number.NaN)).toBe('—')
  })

  it('renders under an hour as m:ss', () => {
    expect(duration(0)).toBe('0:00')
    expect(duration(65)).toBe('1:05')
    expect(duration(3599)).toBe('59:59')
  })

  it('rolls over to h:mm:ss past the hour, rather than "1422:00"', () => {
    expect(duration(3600)).toBe('1:00:00')
    expect(duration(3661)).toBe('1:01:01')
  })

  it('clamps a negative value to zero rather than rendering a negative duration', () => {
    expect(duration(-5)).toBe('0:00')
  })
})

describe('maskPhone', () => {
  it('renders a dash for a missing number', () => {
    expect(maskPhone(null)).toBe('—')
    expect(maskPhone(undefined)).toBe('—')
  })

  it('masks the subscriber digits of a full E.164 number', () => {
    expect(maskPhone('+18574444576')).toBe('+1857…576')
  })

  it('leaves a too-short value unmasked rather than mangling it', () => {
    expect(maskPhone('123')).toBe('123')
  })
})

describe('tone functions cover every real status with a deliberate default', () => {
  it('outcomeTone: resolved outcomes read good, escalations read warn, failures read bad', () => {
    expect(outcomeTone('booking')).toBe('good')
    expect(outcomeTone('resolved')).toBe('good')
    expect(outcomeTone('lead')).toBe('good')
    expect(outcomeTone('transfer')).toBe('warn')
    expect(outcomeTone('callback')).toBe('warn')
    expect(outcomeTone('unresolved')).toBe('bad')
    expect(outcomeTone('failed')).toBe('bad')
    expect(outcomeTone(null)).toBe('neutral')
  })

  it('statusTone: an incomplete record is amber, a caller who heard nothing is red', () => {
    expect(statusTone('completed_no_transcript')).toBe('warn')
    expect(statusTone('accept_failed')).toBe('bad')
    expect(statusTone('route_failed')).toBe('bad')
    expect(statusTone('failed')).toBe('bad')
    expect(statusTone('completed')).toBe('good')
    expect(statusTone('live')).toBe('signal')
  })

  it('healthTone: connected good, degraded warn, failed bad', () => {
    expect(healthTone('connected')).toBe('good')
    expect(healthTone('degraded')).toBe('warn')
    expect(healthTone('failed')).toBe('bad')
    expect(healthTone('unknown')).toBe('neutral')
  })

  it('workspaceTone: an archived client reads as dormant, not as a problem needing attention', () => {
    expect(workspaceTone('live')).toBe('good')
    expect(workspaceTone('pilot')).toBe('signal')
    expect(workspaceTone('paused')).toBe('bad')
    expect(workspaceTone('archived')).toBe('neutral')
    expect(workspaceTone('discovery')).toBe('warn')
  })

  it('phoneLifecycleTone: verified/active good, verifying warn, degraded bad, disabled neutral', () => {
    expect(phoneLifecycleTone('active')).toBe('good')
    expect(phoneLifecycleTone('verified')).toBe('good')
    expect(phoneLifecycleTone('verifying')).toBe('warn')
    expect(phoneLifecycleTone('degraded')).toBe('bad')
    expect(phoneLifecycleTone('disabled')).toBe('neutral')
    expect(phoneLifecycleTone('pending')).toBe('warn')
  })
})

describe('PHONE_LIFECYCLE_LABEL / PHONE_LIFECYCLE_HINT', () => {
  const lifecycle = ['pending', 'verifying', 'verified', 'active', 'degraded', 'disabled']

  it('has an Arabic label and a hint for every lifecycle state', () => {
    for (const state of lifecycle) {
      expect(typeof PHONE_LIFECYCLE_LABEL[state]).toBe('string')
      expect(typeof PHONE_LIFECYCLE_HINT[state]).toBe('string')
    }
  })
})
