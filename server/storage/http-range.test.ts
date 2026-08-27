import { describe, expect, it } from 'vitest'
import { parseByteRange } from './http-range'

describe('parseByteRange', () => {
  it('accepts bounded, open-ended, and suffix byte ranges', () => {
    expect(parseByteRange('bytes=10-19', 100)).toEqual({
      header: 'bytes=10-19',
      start: 10,
      end: 19,
      length: 10,
    })
    expect(parseByteRange('bytes=90-', 100)).toEqual({
      header: 'bytes=90-99',
      start: 90,
      end: 99,
      length: 10,
    })
    expect(parseByteRange('bytes=-12', 100)).toEqual({
      header: 'bytes=88-99',
      start: 88,
      end: 99,
      length: 12,
    })
  })

  it('clamps an end beyond the object and a suffix beyond its size', () => {
    expect(parseByteRange('bytes=95-999', 100)).toMatchObject({ start: 95, end: 99, length: 5 })
    expect(parseByteRange('bytes=-999', 100)).toMatchObject({ start: 0, end: 99, length: 100 })
  })

  it('rejects malformed, multipart, reversed, and unsatisfiable ranges', () => {
    expect(parseByteRange('items=0-1', 100)).toBe('invalid')
    expect(parseByteRange('bytes=0-1,3-4', 100)).toBe('invalid')
    expect(parseByteRange('bytes=20-10', 100)).toBe('invalid')
    expect(parseByteRange('bytes=100-', 100)).toBe('invalid')
    expect(parseByteRange('bytes=-0', 100)).toBe('invalid')
  })

  it('treats an absent Range header as a full response', () => {
    expect(parseByteRange(null, 100)).toBeNull()
  })
})
