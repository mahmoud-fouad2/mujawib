import { describe, expect, it } from 'vitest'
import { appUrlProblem, isLocalUrl } from './app-url'

/**
 * The incident this guards against: BETTER_AUTH_URL was set to
 * http://localhost:10000 in production — the port Render's own PORT env var
 * uses, easy to reach for while chasing an unrelated "no open ports detected"
 * warning — and every post-sign-in redirect went there instead of the public
 * site. isLocalUrl/appUrlProblem are what lib/env.ts calls at boot to refuse
 * to start rather than ship that silently; these lock the pure logic down so
 * that check itself cannot regress unnoticed.
 */

describe('isLocalUrl', () => {
  it('flags http and https localhost URLs, with or without a port', () => {
    expect(isLocalUrl('http://localhost')).toBe(true)
    expect(isLocalUrl('http://localhost:10000')).toBe(true)
    expect(isLocalUrl('https://localhost:3000')).toBe(true)
  })

  it('flags 127.0.0.1', () => {
    expect(isLocalUrl('http://127.0.0.1:3000')).toBe(true)
  })

  it('does not flag a real public URL', () => {
    expect(isLocalUrl('https://mujawib.onrender.com')).toBe(false)
  })

  it('does not false-positive on a domain that merely contains "localhost"', () => {
    expect(isLocalUrl('https://notlocalhost.example.com')).toBe(false)
  })
})

describe('appUrlProblem', () => {
  it('is null for two matching, public URLs', () => {
    expect(appUrlProblem('https://mujawib.onrender.com', 'https://mujawib.onrender.com')).toBeNull()
  })

  it('reports BETTER_AUTH_URL when it is localhost — this is the exact incident', () => {
    const problem = appUrlProblem('http://localhost:10000', 'https://mujawib.onrender.com')
    expect(problem).toContain('BETTER_AUTH_URL')
    expect(problem).toContain('localhost:10000')
  })

  it('reports NEXT_PUBLIC_APP_URL when it is localhost', () => {
    const problem = appUrlProblem('https://mujawib.onrender.com', 'http://localhost:3000')
    expect(problem).toContain('NEXT_PUBLIC_APP_URL')
  })

  it('reports a mismatch between two otherwise-valid public URLs', () => {
    const problem = appUrlProblem('https://mujawib.onrender.com', 'https://www.mujawib.com')
    expect(problem).toContain('disagree')
  })

  it('checks BETTER_AUTH_URL first when both are wrong, so the message names one clear fix', () => {
    const problem = appUrlProblem('http://localhost:10000', 'http://localhost:3000')
    expect(problem).toContain('BETTER_AUTH_URL')
  })
})
