import type { NextConfig } from 'next'

const developmentScriptPolicy = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https: wss:",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${developmentScriptPolicy}`,
  "style-src 'self' 'unsafe-inline'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['postgres', 'ws'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  webpack(config) {
    // OpenTelemetry's Node auto-instrumentation (pulled in by @sentry/node for
    // tracing an Express app this project doesn't have) hooks `require()`
    // dynamically to patch libraries at load time — a pattern webpack cannot
    // statically analyze and, correctly, warns about. It is not a bug; it is
    // what `withSentryConfig`'s webpack plugin would normally suppress. Doing
    // it here directly avoids depending on that plugin, which needs a real
    // Sentry auth token/org/project this deployment doesn't have configured
    // yet — source-map upload can adopt it later without touching this.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/require-in-the-middle/ },
    ]
    return config
  },
}

export default nextConfig
