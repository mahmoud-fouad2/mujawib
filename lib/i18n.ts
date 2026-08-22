export type Locale = 'ar' | 'en'

export function dirOf(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function isRtl(locale: Locale) {
  return locale === 'ar'
}

/** App surfaces that exist once and are never mirrored under /en. */
const SHARED_PREFIXES = ['/sign-in', '/invite', '/onboarding', '/console', '/portal', '/api']

/**
 * Arabic lives at the root; English is prefixed with /en.
 *
 * Same-page anchors and shared app routes pass through untouched — prefixing
 * them would produce dead links like `/en/#pricing` or `/en/sign-in`.
 */
export function localePath(locale: Locale, path = '/') {
  if (path.startsWith('#') || path.startsWith('http') || path.startsWith('mailto:')) return path

  const clean = path.startsWith('/') ? path : `/${path}`
  if (SHARED_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))) return clean
  if (locale === 'ar') return clean
  return clean === '/' ? '/en' : `/en${clean}`
}

/** Strips the locale prefix so a path can be re-pointed at the other locale. */
function stripLocale(pathname: string): string {
  if (pathname === '/en') return '/'
  if (pathname.startsWith('/en/')) return pathname.slice(3)
  return pathname
}

export function switchLocalePath(pathname: string, target: Locale) {
  return localePath(target, stripLocale(pathname))
}
