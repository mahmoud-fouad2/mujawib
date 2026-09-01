/**
 * The three identities the suite signs in as, and where their credentials
 * come from.
 *
 * Deliberately from the environment with no defaults: a hardcoded password in
 * a repository is a hardcoded password in production the day someone reuses
 * it. `pnpm e2e` fails loudly with the variable name rather than silently
 * skipping the half of the suite that matters.
 */

export type RoleKey = 'operator' | 'client'

export type RoleCredentials = {
  key: RoleKey
  email: string
  password: string
  /** Where a successful sign-in should land this role. */
  landing: string
  storageState: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} is not set. The end-to-end suite signs in as real users; set the ` +
        'MUJAWIB_E2E_* variables against a disposable database, never production.',
    )
  }
  return value
}

export function credentialsFor(key: RoleKey): RoleCredentials {
  if (key === 'operator') {
    return {
      key,
      email: required('MUJAWIB_E2E_OPERATOR_EMAIL'),
      password: required('MUJAWIB_E2E_OPERATOR_PASSWORD'),
      landing: '/console',
      storageState: '.auth/operator.json',
    }
  }
  return {
    key,
    email: required('MUJAWIB_E2E_CLIENT_EMAIL'),
    password: required('MUJAWIB_E2E_CLIENT_PASSWORD'),
    landing: '/portal',
    storageState: '.auth/client.json',
  }
}

/**
 * Guard against the one mistake that would be unrecoverable.
 *
 * The suite creates and deletes real rows. Pointing it at the production URL
 * would do that to real customer data, so refuse rather than trust that
 * whoever ran it meant to.
 */
export function assertSafeTarget(baseURL: string | undefined) {
  const target = (baseURL ?? '').toLowerCase()
  const allowed =
    target.includes('localhost') ||
    target.includes('127.0.0.1') ||
    target.includes('staging') ||
    process.env.MUJAWIB_E2E_ALLOW_REMOTE === 'i-understand'
  if (!allowed) {
    throw new Error(
      `Refusing to run destructive end-to-end tests against ${baseURL}. ` +
        'Point MUJAWIB_E2E_BASE_URL at localhost or a staging instance.',
    )
  }
}
